-- Restore PostgREST table privileges for authenticated referral reads/writes.
-- RLS remains the row-level boundary; these grants only make the approved
-- referrals policies reachable by the authenticated client role.

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.referrals
  TO authenticated;
