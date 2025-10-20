-- Create table to store the player order for each session
CREATE TABLE public.player_order (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  player_id UUID NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_order ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read player order" 
ON public.player_order 
FOR SELECT 
USING (true);

CREATE POLICY "Session admin can manage player order" 
ON public.player_order 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM sessions 
  WHERE sessions.id = player_order.session_id 
  AND sessions.admin_id = auth.uid()
));

-- Create index for better performance
CREATE INDEX idx_player_order_session ON public.player_order(session_id, order_index);