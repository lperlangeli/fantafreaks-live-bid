import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/RoleBadge";
import { Participant, Player, AssignedPlayer } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ParticipantsListProps {
  sessionId: string;
  participants: Participant[];
  currentUserId?: string;
  isAdmin: boolean;
}

interface ParticipantWithRoster extends Participant {
  roster: Player[];
}

export default function ParticipantsList({ sessionId, participants, currentUserId, isAdmin }: ParticipantsListProps) {
  const [participantsWithRoster, setParticipantsWithRoster] = useState<ParticipantWithRoster[]>([]);
  const [playerToRemove, setPlayerToRemove] = useState<{ playerId: string; playerName: string; participantId: string } | null>(null);

  useEffect(() => {
    loadRosters();

    const channel = supabase
      .channel(`participants_list_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assigned_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadRosters();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, participants]);

  const loadRosters = async () => {
    const participantsData: ParticipantWithRoster[] = [];

    for (const participant of participants) {
      // Get assigned players
      const { data: assigned } = await supabase
        .from("assigned_players")
        .select("player_id")
        .eq("session_id", sessionId)
        .eq("participant_id", participant.id);

      if (!assigned || assigned.length === 0) {
        participantsData.push({ ...participant, roster: [] });
        continue;
      }

      // Get player details
      const { data: players } = await supabase
        .from("players")
        .select("*")
        .in("id", assigned.map(a => a.player_id));

      if (players) {
        // Sort by role order: P, D, C, A
        const roleOrder = { P: 0, D: 1, C: 2, A: 3 };
        const sortedPlayers = (players as Player[]).sort((a, b) => 
          roleOrder[a.role] - roleOrder[b.role]
        );
        participantsData.push({ ...participant, roster: sortedPlayers });
      } else {
        participantsData.push({ ...participant, roster: [] });
      }
    }

    setParticipantsWithRoster(participantsData);
  };

  const getRoleCounts = (roster: Player[]) => {
    return {
      P: roster.filter(p => p.role === 'P').length,
      D: roster.filter(p => p.role === 'D').length,
      C: roster.filter(p => p.role === 'C').length,
      A: roster.filter(p => p.role === 'A').length,
    };
  };

  const handleRemovePlayer = async () => {
    if (!playerToRemove) return;

    try {
      // Get the assigned player entry to get the price
      const { data: assignedPlayer } = await supabase
        .from("assigned_players")
        .select("price")
        .eq("session_id", sessionId)
        .eq("participant_id", playerToRemove.participantId)
        .eq("player_id", playerToRemove.playerId)
        .single();

      // Delete the assignment
      const { error: deleteError } = await supabase
        .from("assigned_players")
        .delete()
        .eq("session_id", sessionId)
        .eq("participant_id", playerToRemove.participantId)
        .eq("player_id", playerToRemove.playerId);

      if (deleteError) {
        toast.error("Errore durante la rimozione");
        return;
      }

      // Refund credits to participant
      if (assignedPlayer) {
        const participant = participants.find(p => p.id === playerToRemove.participantId);
        if (participant) {
          await supabase
            .from("participants")
            .update({ credits: participant.credits + assignedPlayer.price })
            .eq("id", playerToRemove.participantId);
        }
      }

      // Remove from selected_players if exists
      await supabase
        .from("selected_players")
        .delete()
        .eq("session_id", sessionId)
        .eq("player_id", playerToRemove.playerId);

      toast.success(`${playerToRemove.playerName} rimosso`);
      setPlayerToRemove(null);
    } catch (error) {
      toast.error("Errore imprevisto");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partecipanti</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {participantsWithRoster.map((participant) => {
            const roleCounts = getRoleCounts(participant.roster);
            const isCurrentUser = participant.user_id === currentUserId;

            return (
              <Card 
                key={participant.id} 
                className={isCurrentUser ? "border-primary border-2" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {participant.nickname}
                      {isCurrentUser && (
                        <Badge variant="outline" className="ml-2 text-xs">Tu</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-sm font-bold text-primary">
                      <Coins className="h-4 w-4" />
                      {participant.credits}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Role Summary */}
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <RoleBadge role="P" className="w-4 h-4 text-xs" />
                      {roleCounts.P}/3
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <RoleBadge role="D" className="w-4 h-4 text-xs" />
                      {roleCounts.D}/8
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <RoleBadge role="C" className="w-4 h-4 text-xs" />
                      {roleCounts.C}/8
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <RoleBadge role="A" className="w-4 h-4 text-xs" />
                      {roleCounts.A}/6
                    </Badge>
                  </div>

                  {/* Roster */}
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {participant.roster.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nessun giocatore
                      </p>
                    ) : (
                      participant.roster.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => isAdmin && setPlayerToRemove({
                            playerId: player.id,
                            playerName: player.name,
                            participantId: participant.id
                          })}
                          disabled={!isAdmin}
                          className={`w-full flex items-center gap-2 text-xs p-1 rounded transition-colors ${
                            isAdmin ? 'hover:bg-accent/50 cursor-pointer' : ''
                          }`}
                        >
                          <RoleBadge role={player.role} className="w-4 h-4 text-[10px]" />
                          <span className="flex-1 truncate text-left">{player.name}</span>
                          {isAdmin && (
                            <Trash2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <AlertDialog open={!!playerToRemove} onOpenChange={() => setPlayerToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rimuovi Giocatore</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler rimuovere <strong>{playerToRemove?.playerName}</strong>?
                I crediti verranno restituiti al partecipante.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemovePlayer}>
                Rimuovi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
