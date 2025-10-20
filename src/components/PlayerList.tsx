import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/components/RoleBadge";
import { Player, Role } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";

interface PlayerListProps {
  sessionId: string;
  selectedRole?: Role | "ALL";
  isAdmin: boolean;
}

export default function PlayerList({ sessionId, selectedRole = "ALL", isAdmin }: PlayerListProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadSelectedPlayers();

    const channel = supabase
      .channel(`player_list_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "selected_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadSelectedPlayers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assigned_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadSelectedPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, selectedRole]);

  const loadSelectedPlayers = async () => {
    // Get assigned players to exclude them
    const { data: assigned } = await supabase
      .from("assigned_players")
      .select("player_id")
      .eq("session_id", sessionId);

    const assignedIds = new Set(assigned?.map(a => a.player_id) || []);

    // Get ALL players (not just selected ones) with role filter, excluding assigned
    let query = supabase
      .from("players")
      .select("*");
    
    // Apply role filter if not "ALL"
    if (selectedRole && selectedRole !== "ALL") {
      query = query.eq("role", selectedRole);
    }
    
    // Order by FVM value descending
    const { data: players } = await query.order("fvm_value", { ascending: false });

    if (players) {
      // Filter out assigned players
      const availablePlayers = (players as Player[]).filter(p => !assignedIds.has(p.id));
      setSelectedPlayers(availablePlayers);
    } else {
      setSelectedPlayers([]);
    }
  };

  const handleSelectPlayer = async (playerId: string) => {
    // Removed: players can only be selected via navigation buttons in LivePlayer
    return;
  };

  return (
    <Card className="h-[400px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Elenco per Quotazione
          {selectedRole && selectedRole !== "ALL" && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({selectedRole === 'P' ? 'Portieri' : 
                selectedRole === 'D' ? 'Difensori' :
                selectedRole === 'C' ? 'Centrocampisti' : 'Attaccanti'})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {selectedPlayers.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            {selectedRole && selectedRole !== "ALL" 
              ? `Nessun giocatore disponibile per questo ruolo`
              : `Nessun giocatore disponibile`}
          </p>
        ) : (
          selectedPlayers.map((player) => (
            <div
              key={player.id}
              className={`w-full p-3 rounded-lg border bg-card`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <RoleBadge role={player.role} />
                    <span className="font-medium text-sm">{player.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{player.team}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {player.fvm_value}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
