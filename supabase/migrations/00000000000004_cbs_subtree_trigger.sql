-- Migration: Add DB trigger for CBS node subtree budget recompute
-- Date: 2026-08-01
--
-- When a CBS node's budget/committed/actual/forecast is updated, this
-- trigger walks UP the tree and recomputes each ancestor's aggregated
-- values from its children. This ensures the rollup stays correct
-- regardless of the write path (API, direct SQL, another client) —
-- closing the gap where only the client-side updateNode hook kept
-- parents in sync.
--
-- margin_pct is recomputed as (budget - actual) / budget * 100, guarded
-- against divide-by-zero.

CREATE OR REPLACE FUNCTION recompute_cbs_subtree()
RETURNS TRIGGER AS $$
DECLARE
  parent_code_val TEXT;
  current_code_val TEXT;
BEGIN
  -- Re-entrancy guard: the walk-up loop and the self-recompute block below
  -- both issue UPDATE cbs_nodes, which re-fires THIS trigger. Without this
  -- guard, any node with children recurses forever (stack depth exceeded).
  -- pg_trigger_depth() = 1 means this is the original firing; > 1 means we're
  -- already inside this trigger's execution, so bail out.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- After an INSERT/UPDATE on cbs_nodes, recompute the node's parent
  -- (and recursively up to the root) from its children.
  current_code_val := COALESCE(NEW.code, OLD.code);
  parent_code_val := COALESCE(NEW.parent_code, OLD.parent_code);

  -- Walk up the tree, recomputing each ancestor from its children.
  WHILE parent_code_val IS NOT NULL LOOP
    UPDATE cbs_nodes SET
      budget = COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      committed = COALESCE((SELECT SUM(committed) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      actual = COALESCE((SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      forecast = COALESCE((SELECT SUM(forecast) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      margin_pct = CASE
        WHEN COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val), 0) > 0
        THEN ROUND(
          ((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val) -
           (SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = parent_code_val)) /
          (SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val) * 100.0,
          2
        )
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = parent_code_val;

    -- Move up to the next ancestor.
    SELECT parent_code INTO parent_code_val FROM cbs_nodes WHERE code = parent_code_val;
  END LOOP;

  -- Also recompute the node itself if it has children (so its own row
  -- reflects the sum of its children, not just a manually-entered value).
  IF EXISTS (SELECT 1 FROM cbs_nodes WHERE parent_code = current_code_val) THEN
    UPDATE cbs_nodes SET
      budget = COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      committed = COALESCE((SELECT SUM(committed) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      actual = COALESCE((SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      forecast = COALESCE((SELECT SUM(forecast) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      margin_pct = CASE
        WHEN COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val), 0) > 0
        THEN ROUND(
          ((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val) -
           (SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = current_code_val)) /
          (SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val) * 100.0,
          2
        )
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = current_code_val;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (idempotent migration), then create.
DROP TRIGGER IF EXISTS cbs_nodes_subtree_recompute ON cbs_nodes;

CREATE TRIGGER cbs_nodes_subtree_recompute
  AFTER INSERT OR UPDATE OR DELETE ON cbs_nodes
  FOR EACH ROW EXECUTE FUNCTION recompute_cbs_subtree();
