-- Function to process referral reward
CREATE OR REPLACE FUNCTION process_referral_reward(referrer_uuid UUID, referred_uuid UUID)
RETURNS VOID AS $$
DECLARE
  reward_amount DECIMAL(10,2) := 100.00;
BEGIN
  -- Insert referral record
  INSERT INTO referrals (referrer_id, referred_id, reward_amount)
  VALUES (referrer_uuid, referred_uuid, reward_amount);
  
  -- Update referrer's earnings and referral count
  UPDATE users 
  SET 
    total_earnings = total_earnings + reward_amount,
    available_balance = available_balance + reward_amount,
    total_referrals = total_referrals + 1,
    updated_at = NOW()
  WHERE id = referrer_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to process withdrawal
CREATE OR REPLACE FUNCTION process_withdrawal(withdrawal_uuid UUID, new_status VARCHAR(20), notes TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  withdrawal_record RECORD;
  withdrawal_charge DECIMAL(10,2) := 50.00;
  total_deduction DECIMAL(10,2);
BEGIN
  -- Get withdrawal details
  SELECT * INTO withdrawal_record FROM withdrawals WHERE id = withdrawal_uuid;
  
  IF withdrawal_record IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  -- Calculate total deduction (withdrawal amount + charge)
  total_deduction := withdrawal_record.amount + withdrawal_charge;
  
  -- Update withdrawal status
  UPDATE withdrawals 
  SET 
    status = new_status,
    admin_notes = COALESCE(notes, admin_notes),
    processed_at = CASE WHEN new_status != 'pending' THEN NOW() ELSE processed_at END
  WHERE id = withdrawal_uuid;
  
  -- If approved, deduct from user's available balance (amount + charge)
  IF new_status = 'approved' THEN
    UPDATE users 
    SET 
      available_balance = available_balance - total_deduction,
      updated_at = NOW()
    WHERE id = withdrawal_record.user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
