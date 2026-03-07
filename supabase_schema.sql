-- USERS / PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('employer', 'freelancer', 'admin', 'guest')) NOT NULL,
  staff_roles TEXT[] DEFAULT '{}',
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

-- DELETED USERS ARCHIVE (for admin restore)
CREATE TABLE IF NOT EXISTS deleted_users (
  id BIGSERIAL PRIMARY KEY,
  original_user_id UUID,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  full_name TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  location TEXT,
  hourly_rate TEXT,
  phone TEXT,
  website TEXT,
  iban TEXT,
  avatar_url TEXT,
  created_at_profile TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  deleted_by_admin_id UUID REFERENCES auth.users ON DELETE SET NULL,
  delete_reason TEXT,
  source TEXT,
  restore_status TEXT CHECK (restore_status IN ('deleted', 'restored')) DEFAULT 'deleted',
  restored_at TIMESTAMP WITH TIME ZONE,
  restored_user_id UUID,
  restored_by_admin_id UUID REFERENCES auth.users ON DELETE SET NULL,
  raw_profile JSONB,
  raw_auth_user JSONB
);

CREATE INDEX IF NOT EXISTS deleted_users_restore_status_idx ON deleted_users(restore_status, deleted_at DESC);

-- GIGS TABLE
CREATE TABLE IF NOT EXISTS gigs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  service_type TEXT,
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

-- REVIEWS / RATINGS
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- One review per order per reviewer
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_order_from ON reviews(order_id, from_user_id);

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

-- SUPPORT TICKET REPLIES (multi-reply history)
CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  author_role TEXT CHECK (author_role IN ('admin', 'user')) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS support_ticket_replies_ticket_id_created_at_idx
  ON support_ticket_replies(ticket_id, created_at);

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
ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can view reviews" ON reviews;
CREATE POLICY "Users can view reviews" ON reviews
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create review for completed order" ON reviews;
CREATE POLICY "Users can create review for completed order" ON reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = reviews.order_id
        AND o.status = 'completed'
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
        AND (reviews.to_user_id = o.buyer_id OR reviews.to_user_id = o.seller_id)
        AND reviews.to_user_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public tickets" ON support_tickets;
CREATE POLICY "Public tickets" ON support_tickets FOR ALL USING (true);

DROP POLICY IF EXISTS "Public ticket replies" ON support_ticket_replies;
CREATE POLICY "Public ticket replies" ON support_ticket_replies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can write ticket replies" ON support_ticket_replies;
CREATE POLICY "Admins can write ticket replies" ON support_ticket_replies
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can write own ticket replies" ON support_ticket_replies;
CREATE POLICY "Users can write own ticket replies" ON support_ticket_replies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM support_tickets t
      WHERE t.id = support_ticket_replies.ticket_id
        AND t.from_email = (auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Users can create deletion requests" ON account_deletion_requests;
CREATE POLICY "Users can create deletion requests" ON account_deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view deletion requests" ON account_deletion_requests;
CREATE POLICY "Admins can view deletion requests" ON account_deletion_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can view deleted users archive" ON deleted_users;
CREATE POLICY "Admins can view deleted users archive" ON deleted_users
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- STORAGE POLICIES (Run these in SQL Editor)
-- 1. Allow public access to view avatars
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Policy for viewing
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

-- Policy for uploading (Authenticated users can upload to avatars bucket)
-- CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Policy for updating/deleting (Users can manage their own files)
-- CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING ( bucket_id = 'avatars' AND auth.uid() = owner );

-- ORDER CANCELLATION REQUESTS
CREATE TABLE IF NOT EXISTS order_cancellation_requests (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  requester_username TEXT NOT NULL,
  requester_role TEXT CHECK (requester_role IN ('employer', 'freelancer')) NOT NULL,
  responder_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  responder_username TEXT NOT NULL,
  responder_role TEXT CHECK (responder_role IN ('employer', 'freelancer')) NOT NULL,
  compensation_rate NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'admin_approved', 'admin_rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  resolved_by_admin_id UUID REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE order_cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their cancellation requests" ON order_cancellation_requests;
CREATE POLICY "Users can view their cancellation requests" ON order_cancellation_requests
  FOR SELECT
  USING (
    auth.uid() = requester_id
    OR auth.uid() = responder_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can create cancellation requests" ON order_cancellation_requests;
CREATE POLICY "Users can create cancellation requests" ON order_cancellation_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Responder can update cancellation requests" ON order_cancellation_requests;
CREATE POLICY "Responder can update cancellation requests" ON order_cancellation_requests
  FOR UPDATE
  USING (
    auth.uid() = responder_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- PAYMENT / PAYTR FIELDS
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_merchant_oid TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount_minor INTEGER,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_merchant_oid_uniq
  ON orders(payment_merchant_oid)
  WHERE payment_merchant_oid IS NOT NULL;

CREATE TABLE IF NOT EXISTS paytr_events (
  id BIGSERIAL PRIMARY KEY,
  merchant_oid TEXT NOT NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  status TEXT,
  total_amount TEXT,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- STAFF ROLES (for existing databases)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS staff_roles TEXT[] DEFAULT '{}';

-- SUPPORT V2 FIELDS
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_admin_username TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS support_tickets_priority_status_idx
  ON support_tickets(priority, status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_assigned_admin_idx
  ON support_tickets(assigned_admin_id, created_at DESC);

-- ADMIN AUDIT LOG
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx
  ON admin_audit_logs(action, created_at DESC);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can view audit logs" ON admin_audit_logs
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Users can insert own audit logs" ON admin_audit_logs;
CREATE POLICY "Users can insert own audit logs" ON admin_audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- PAYTR EVENT LOG ACCESS
ALTER TABLE paytr_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view paytr events" ON paytr_events;
CREATE POLICY "Admins can view paytr events" ON paytr_events
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- COLLABORATION V2 (FEATURES 3-12)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  ADD COLUMN IF NOT EXISTS quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  ADD COLUMN IF NOT EXISTS speed_rating INTEGER CHECK (speed_rating >= 1 AND speed_rating <= 5),
  ADD COLUMN IF NOT EXISTS moderated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS moderation_note TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portfolio_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avg_response_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS order_disputes (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  opened_by_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  opened_by_role TEXT CHECK (opened_by_role IN ('employer', 'freelancer')) NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB,
  status TEXT CHECK (status IN ('open', 'under_review', 'resolved_for_employer', 'resolved_for_freelancer', 'rejected')) DEFAULT 'open',
  resolution_note TEXT,
  resolved_by_admin_id UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS order_workspace_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  author_role TEXT CHECK (author_role IN ('employer', 'freelancer')) NOT NULL,
  kind TEXT CHECK (kind IN ('todo', 'note', 'checklist')) DEFAULT 'todo',
  content TEXT NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS order_schedule_requests (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  requester_role TEXT CHECK (requester_role IN ('employer', 'freelancer')) NOT NULL,
  responder_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  requested_days INTEGER NOT NULL CHECK (requested_days > 0),
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, target_user_id)
);

ALTER TABLE order_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_workspace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_schedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own disputes" ON order_disputes;
CREATE POLICY "Users can view own disputes" ON order_disputes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_disputes.order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can create disputes" ON order_disputes;
CREATE POLICY "Users can create disputes" ON order_disputes
  FOR INSERT
  WITH CHECK (auth.uid() = opened_by_id);

DROP POLICY IF EXISTS "Users can view workspace" ON order_workspace_items;
CREATE POLICY "Users can view workspace" ON order_workspace_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_workspace_items.order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  );

DROP POLICY IF EXISTS "Users can write workspace" ON order_workspace_items;
CREATE POLICY "Users can write workspace" ON order_workspace_items
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can update workspace" ON order_workspace_items;
CREATE POLICY "Users can update workspace" ON order_workspace_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_workspace_items.order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  );

DROP POLICY IF EXISTS "Users can view schedule requests" ON order_schedule_requests;
CREATE POLICY "Users can view schedule requests" ON order_schedule_requests
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

DROP POLICY IF EXISTS "Users can create schedule requests" ON order_schedule_requests;
CREATE POLICY "Users can create schedule requests" ON order_schedule_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Responder can update schedule requests" ON order_schedule_requests;
CREATE POLICY "Responder can update schedule requests" ON order_schedule_requests
  FOR UPDATE
  USING (auth.uid() = responder_id);

DROP POLICY IF EXISTS "Users can view favorites" ON user_favorites;
CREATE POLICY "Users can view favorites" ON user_favorites
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

DROP POLICY IF EXISTS "Users can manage favorites" ON user_favorites;
CREATE POLICY "Users can manage favorites" ON user_favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
