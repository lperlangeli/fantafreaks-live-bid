export type Role = 'P' | 'D' | 'C' | 'A';
export type AuctionOrder = 'alphabetical' | 'random';

export interface Session {
  id: string;
  session_code: string;
  admin_id: string;
  num_participants: number;
  budget_per_participant: number;
  auction_order: AuctionOrder;
  starting_letter: string | null;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  user_id: string;
  nickname: string;
  credits: number;
  position: number;
  created_at: string;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  role: Role;
  fvm_value: number;
  created_at: string;
}

export interface SelectedPlayer {
  id: string;
  session_id: string;
  player_id: string;
  created_at: string;
}

export interface AssignedPlayer {
  id: string;
  session_id: string;
  participant_id: string;
  player_id: string;
  price: number;
  assigned_at: string;
  assignment_order: number;
}

export interface CurrentPlayer {
  id: string;
  session_id: string;
  player_id: string | null;
  updated_at: string;
}

export interface PlayerWithDetails extends Player {
  isSelected?: boolean;
  isAssigned?: boolean;
}
