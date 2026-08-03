-- 1. Add Bank Details to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS bank_ifsc TEXT;

-- 2. Add Unit to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'NOS';

-- 3. Populate default values for Bank Details and Owner Address on the main settings row
UPDATE settings 
SET 
  bank_name = COALESCE(bank_name, 'ICICI BANK'),
  bank_account_no = COALESCE(bank_account_no, '646105500575'),
  bank_branch = COALESCE(bank_branch, 'PUNE ERANDWANE'),
  bank_ifsc = COALESCE(bank_ifsc, 'ICIC0006461'),
  company_address = 'GROUND FLOOR, SHOP NO 2 DAMODHAR
APARTMENT ,CTC NO 5, GARDEN VIEW APARTMENT
ERADWANE, PUNE'
WHERE id = 'main';
