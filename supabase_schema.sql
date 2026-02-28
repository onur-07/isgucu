-- USERS / PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('employer', 'freelancer', 'admin', 'guest')) NOT NULL,
  full_name TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  location TEXT,
  hourly_rate TEXT,
  phone TEXT,
  website TEXT,
  iban TEXT,
  avatar_url TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ACCOUNT DELETION REQUESTS
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- GIGS TABLE
CREATE TABLE IF NOT EXISTS gigs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL NOT NULL,
  category TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  packages JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_username TEXT NOT NULL,
  receiver_username TEXT NOT NULL,
  text TEXT,
  file_data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- OFFERS TABLE (Chat proposals)
CREATE TABLE IF NOT EXISTS offers (
  id BIGSERIAL PRIMARY KEY,
  gig_id BIGINT REFERENCES gigs(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  sender_username TEXT NOT NULL,
  receiver_username TEXT NOT NULL,
  message TEXT,
  price DECIMAL NOT NULL,
  delivery_days INTEGER NOT NULL,
  extras JSONB,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE
);

-- ORDERS TABLE (Checkout)
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  gig_id BIGINT REFERENCES gigs(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  buyer_username TEXT NOT NULL,
  seller_username TEXT NOT NULL,
  package_key TEXT,
  base_price DECIMAL NOT NULL,
  extras_price DECIMAL DEFAULT 0,
  total_price DECIMAL NOT NULL,
  base_days INTEGER DEFAULT 0,
  extras_days INTEGER DEFAULT 0,
  total_days INTEGER DEFAULT 0,
  extras JSONB,
  status TEXT CHECK (status IN ('pending', 'active', 'delivered', 'completed', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  paid_to_seller BOOLEAN DEFAULT FALSE
);

-- ORDER DELIVERIES / REVISIONS
CREATE TABLE IF NOT EXISTS order_deliveries (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  sender_role TEXT CHECK (sender_role IN ('freelancer', 'employer')) NOT NULL,
  kind TEXT CHECK (kind IN ('delivery', 'revision_request', 'accept')) NOT NULL,
  message TEXT,
  files JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- WALLET LEDGER (credits/debits)
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('credit', 'debit')) NOT NULL,
  amount DECIMAL NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- PAYOUT REQUESTS (withdrawals)
CREATE TABLE IF NOT EXISTS payout_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users ON DELETE SET NULL
);

-- SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  from_user TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('open', 'replied', 'closed')) DEFAULT 'open',
  reply TEXT,
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- JOBS TABLE (Projects posted by Employers)
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  budget TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public gigs are viewable by everyone" ON gigs;
CREATE POLICY "Public gigs are viewable by everyone" ON gigs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own gigs" ON gigs;
CREATE POLICY "Users can manage own gigs" ON gigs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public jobs are viewable by everyone" ON jobs;
CREATE POLICY "Public jobs are viewable by everyone" ON jobs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own jobs" ON jobs;
CREATE POLICY "Users can manage own jobs" ON jobs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their offers" ON offers;
CREATE POLICY "Users can view their offers" ON offers FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Users can create offers" ON offers;
CREATE POLICY "Users can create offers" ON offers FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Receiver can respond to offer" ON offers;
CREATE POLICY "Receiver can respond to offer" ON offers FOR UPDATE USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can view their orders" ON orders;
CREATE POLICY "Users can view their orders" ON orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
DROP POLICY IF EXISTS "Buyer can create order" ON orders;
CREATE POLICY "Buyer can create order" ON orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Users can update their orders" ON orders;
CREATE POLICY "Users can update their orders" ON orders FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can view their deliveries" ON order_deliveries;
CREATE POLICY "Users can view their deliveries" ON order_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_deliveries.order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  );

DROP POLICY IF EXISTS "Users can create deliveries" ON order_deliveries;
CREATE POLICY "Users can create deliveries" ON order_deliveries
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_deliveries.order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  );

DROP POLICY IF EXISTS "Users can view their wallet ledger" ON wallet_ledger;
CREATE POLICY "Users can view their wallet ledger" ON wallet_ledger
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can insert wallet ledger" ON wallet_ledger;
CREATE POLICY "Admins can insert wallet ledger" ON wallet_ledger
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Buyer can credit seller on completion" ON wallet_ledger;
CREATE POLICY "Buyer can credit seller on completion" ON wallet_ledger
  FOR INSERT
  WITH CHECK (
    type = 'credit'
    AND amount >= 0
    AND order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = wallet_ledger.order_id
        AND auth.uid() = o.buyer_id
        AND wallet_ledger.user_id = o.seller_id
        AND o.status = 'completed'
        AND o.paid_to_seller = FALSE
    )
  );

DROP POLICY IF EXISTS "Users can create payout requests" ON payout_requests;
CREATE POLICY "Users can create payout requests" ON payout_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view payout requests" ON payout_requests;
CREATE POLICY "Users can view payout requests" ON payout_requests
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update payout requests" ON payout_requests;
CREATE POLICY "Admins can update payout requests" ON payout_requests
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Public tickets" ON support_tickets;
CREATE POLICY "Public tickets" ON support_tickets FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can create deletion requests" ON account_deletion_requests;
CREATE POLICY "Users can create deletion requests" ON account_deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view deletion requests" ON account_deletion_requests;
CREATE POLICY "Admins can view deletion requests" ON account_deletion_requests FOR SELECT USING (true);

-- STORAGE POLICIES (Run these in SQL Editor)
-- 1. Allow public access to view avatars
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Policy for viewing
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

-- Policy for uploading (Authenticated users can upload to avatars bucket)
-- CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Policy for updating/deleting (Users can manage their own files)
-- CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING ( bucket_id = 'avatars' AND auth.uid() = owner );
