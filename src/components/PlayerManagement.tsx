import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/RoleBadge";
import { Player, Role } from "@/types/database";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface PlayerManagementProps {
  sessionId: string;
  isAdmin: boolean;
  onRoleChange?: (role: Role) => void;
}

export default function PlayerManagement({ sessionId, isAdmin, onRoleChange }: PlayerManagementProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role>("P");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [assignedPlayers, setAssignedPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPlayers();
    loadSelectedPlayers();
    loadAssignedPlayers();

    // Subscribe to changes
    const channel = supabase
      .channel(`player_management_${sessionId}`)
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
          loadAssignedPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    filterPlayers();
  }, [players, selectedRole, searchQuery, selectedPlayers, assignedPlayers]);

  const loadPlayers = async () => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .order("name");
    
    if (data) {
      setPlayers(data as Player[]);
    }
  };

  const loadSelectedPlayers = async () => {
    const { data } = await supabase
      .from("selected_players")
      .select("player_id")
      .eq("session_id", sessionId);
    
    if (data) {
      setSelectedPlayers(new Set(data.map(sp => sp.player_id)));
    } else {
      setSelectedPlayers(new Set());
    }
  };

  const loadAssignedPlayers = async () => {
    const { data } = await supabase
      .from("assigned_players")
      .select("player_id")
      .eq("session_id", sessionId);
    
    if (data) {
      setAssignedPlayers(new Set(data.map(ap => ap.player_id)));
    } else {
      setAssignedPlayers(new Set());
    }
  };

  const filterPlayers = () => {
    // Don't filter out assigned players anymore
    let filtered = players.filter(p => p.role === selectedRole);

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.team.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPlayers(filtered.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleSelectPlayer = async (player: Player) => {
    if (!isAdmin) return;

    // Update current player
    await supabase
      .from("current_player")
      .update({ player_id: player.id })
      .eq("session_id", sessionId);

    // Update selected players
    await supabase
      .from("selected_players")
      .delete()
      .eq("session_id", sessionId);

    await supabase
      .from("selected_players")
      .insert({ session_id: sessionId, player_id: player.id });

    toast.success(`${player.name} selezionato`);
  };

  const roleButtons: Array<{ role: Role; label: string }> = [
    { role: "P", label: "P" },
    { role: "D", label: "D" },
    { role: "C", label: "C" },
    { role: "A", label: "A" },
  ];

  const roleCounts = {
    P: players.filter(p => p.role === 'P').length,
    D: players.filter(p => p.role === 'D').length,
    C: players.filter(p => p.role === 'C').length,
    A: players.filter(p => p.role === 'A').length,
  };

  return (
    <Card className="h-[400px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Gestione</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Role Filters */}
        <div className="flex gap-2">
          {roleButtons.map(({ role, label }) => (
            <Button
              key={role}
              variant={selectedRole === role ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedRole(role);
                onRoleChange?.(role);
              }}
              className="flex-1"
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca giocatore..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Role Count */}
        <div className="text-sm text-muted-foreground">
          {selectedRole === 'P' ? 'Portieri' : 
           selectedRole === 'D' ? 'Difensori' :
           selectedRole === 'C' ? 'Centrocampisti' : 'Attaccanti'}: {roleCounts[selectedRole]} giocatori
        </div>

        {/* Player List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredPlayers.map((player) => {
            const isAssigned = assignedPlayers.has(player.id);
            const isSelected = selectedPlayers.has(player.id);
            
            return (
              <button
                key={player.id}
                onClick={() => handleSelectPlayer(player)}
                disabled={!isAdmin || isAssigned}
                className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <RoleBadge role={player.role} />
                      <span className="font-medium text-sm">{player.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{player.team}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-bold">{player.fvm_value}</Badge>
                    {isAssigned && (
                      <Badge variant="default" className="text-xs">Assegnato</Badge>
                    )}
                    {isSelected && !isAssigned && (
                      <Badge variant="outline" className="text-xs">Selezionato</Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
