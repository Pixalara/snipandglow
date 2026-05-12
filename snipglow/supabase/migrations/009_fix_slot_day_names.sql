-- Migration: 009_fix_slot_day_names
-- Fix: get_available_slots was using 3-letter day abbreviations (mon, tue)
-- but operating_hours stores full day names (monday, tuesday).

CREATE OR REPLACE FUNCTION get_available_slots(
  p_employee_id UUID,
  p_date DATE,
  p_duration INT
)
RETURNS TABLE(slot_start TIME, slot_end TIME) AS $$
DECLARE
  v_branch_id UUID;
  v_day_name TEXT;
  v_open_time TIME;
  v_close_time TIME;
  v_slot_interval INTERVAL;
BEGIN
  -- Get employee's branch
  SELECT e.branch_id INTO v_branch_id
  FROM employees e WHERE e.id = p_employee_id;

  -- Get full day name (lowercase) e.g. 'monday', 'tuesday'
  v_day_name := LOWER(to_char(p_date, 'FMDay'));

  -- Get branch operating hours for this day
  SELECT
    (b.operating_hours -> v_day_name ->> 'open')::TIME,
    (b.operating_hours -> v_day_name ->> 'close')::TIME
  INTO v_open_time, v_close_time
  FROM branches b WHERE b.id = v_branch_id;

  -- If branch is closed on this day (no hours defined), return empty
  IF v_open_time IS NULL OR v_close_time IS NULL THEN
    RETURN;
  END IF;

  v_slot_interval := (p_duration || ' minutes')::INTERVAL;

  -- Generate all possible slots at 30-minute intervals,
  -- excluding those that overlap with existing booked appointments
  RETURN QUERY
  SELECT
    gs.slot AS slot_start,
    (gs.slot + v_slot_interval)::TIME AS slot_end
  FROM generate_series(v_open_time, v_close_time - v_slot_interval, INTERVAL '30 minutes') AS gs(slot)
  WHERE NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.employee_id = p_employee_id
      AND a.appointment_date = p_date
      AND a.status != 'cancelled'
      AND tsrange(
        (p_date + gs.slot)::timestamp,
        (p_date + gs.slot + v_slot_interval)::timestamp
      ) && tsrange(
        (p_date + a.start_time)::timestamp,
        (p_date + a.end_time)::timestamp
      )
  )
  ORDER BY gs.slot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
