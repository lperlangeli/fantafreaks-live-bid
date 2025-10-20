import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleBadge } from "@/components/RoleBadge";
import { CurrentPlayer, Participant, Player, AssignedPlayer, Session } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Undo, ChevronLeft, ChevronRight } from "lucide-react";

interface LivePlayerProps {
  sessionId: string;
  session: Session;
  currentPlayer: CurrentPlayer | null;
  participants: Participant[];
  isAdmin: boolean;
}

export default function LivePlayer({ sessionId, session, currentPlayer, participants, isAdmin }: LivePlayerProps) {
  const [playerDetails, setPlayerDetails] = useState<Player | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [lastAssignment, setLastAssignment] = useState<AssignedPlayer | null>(null);
  const [orderedPlayers, setOrderedPlayers] = useState<Player[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      console.log('Loading ordered players for session:', sessionId);
      
      const { data: orderData, error } = await supabase
        .from("player_order")
        .select("player_id")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: true });

      console.log('Player order data:', orderData, 'Error:', error);

      if (mounted && orderData && orderData.length > 0) {
        const playerIds = orderData.map(o => o.player_id);
        
        const { data: players } = await supabase
          .from("players")
          .select("*")
          .in("id", playerIds);

        console.log('Players fetched:', players?.length);

        if (mounted && players) {
          const orderedPlayersList = playerIds
            .map(id => (players as Player[]).find(p => p.id === id))
            .filter(p => p !== undefined) as Player[];
          
          console.log('Ordered players list length:', orderedPlayersList.length);
          setOrderedPlayers(orderedPlayersList);
        }
      } else if (mounted) {
        console.log('No player order found, list is empty');
        setOrderedPlayers([]);
      }
    };

    loadData();

    // Subscribe to player_order changes
    const channel = supabase
      .channel(`player_order_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_order",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          console.log('🔔 Real-time event received for player_order');
          loadData();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (currentPlayer?.player_id) {
      loadPlayerDetails(currentPlayer.player_id);
      // Update current index
      const index = orderedPlayers.findIndex(p => p.id === currentPlayer.player_id);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    } else {
      setPlayerDetails(null);
    }
  }, [currentPlayer, orderedPlayers]);

  useEffect(() => {
    loadLastAssignment();
  }, [sessionId]);


  const loadPlayerDetails = async (playerId: string) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();
    
    if (data) {
      setPlayerDetails(data as Player);
    }
  };

  const loadLastAssignment = async () => {
    const { data } = await supabase
      .from("assigned_players")
      .select("*")
      .eq("session_id", sessionId)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setLastAssignment(data as AssignedPlayer);
    }
  };

  const handleAssign = async () => {
    if (!isAdmin) {
      toast.error("Solo l'admin può assegnare giocatori");
      return;
    }

    if (!playerDetails || !selectedParticipantId || !price) {
      toast.error("Seleziona partecipante e inserisci prezzo");
      return;
    }

    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum < 1) {
      toast.error("Prezzo non valido");
      return;
    }

    const participant = participants.find(p => p.id === selectedParticipantId);
    if (!participant) {
      toast.error("Partecipante non trovato");
      return;
    }

    if (participant.credits < priceNum) {
      toast.error("Crediti insufficienti");
      return;
    }

    // Check role limits
    const { data: assignedPlayers } = await supabase
      .from("assigned_players")
      .select("player_id")
      .eq("session_id", sessionId)
      .eq("participant_id", selectedParticipantId);

    if (assignedPlayers) {
      const playerIds = assignedPlayers.map(ap => ap.player_id);
      const { data: players } = await supabase
        .from("players")
        .select("role")
        .in("id", playerIds);

      if (players) {
        const roleCounts = players.reduce((acc, p) => {
          acc[p.role] = (acc[p.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const limits = { P: 3, D: 8, C: 8, A: 6 };
        if ((roleCounts[playerDetails.role] || 0) >= limits[playerDetails.role]) {
          toast.error(`Limite raggiunto per ruolo ${playerDetails.role}`);
          return;
        }
      }
    }

    // Get assignment order
    const { data: assignedCount } = await supabase
      .from("assigned_players")
      .select("id", { count: "exact" })
      .eq("session_id", sessionId);

    const assignmentOrder = (assignedCount?.length || 0) + 1;

    // Assign player
    const { error: assignError } = await supabase
      .from("assigned_players")
      .insert({
        session_id: sessionId,
        participant_id: selectedParticipantId,
        player_id: playerDetails.id,
        price: priceNum,
        assignment_order: assignmentOrder,
      });

    if (assignError) {
      toast.error("Errore durante l'assegnazione");
      return;
    }

    // Update participant credits
    await supabase
      .from("participants")
      .update({ credits: participant.credits - priceNum })
      .eq("id", selectedParticipantId);

    toast.success(`${playerDetails.name} assegnato a ${participant.nickname}!`);
    setSelectedParticipantId("");
    setPrice("");
    
    // Move to next player
    handleNext();
  };

  const handleDiscard = async () => {
    if (!isAdmin || !playerDetails) {
      toast.error("Solo l'admin può scartare giocatori");
      return;
    }

    toast.info(`${playerDetails.name} scartato`);
    
    // Move to next player
    handleNext();
  };

  const handleNext = async () => {
    if (!isAdmin || orderedPlayers.length === 0) return;

    const nextIndex = (currentIndex + 1) % orderedPlayers.length;
    const nextPlayer = orderedPlayers[nextIndex];

    await updateCurrentPlayer(nextPlayer.id);
  };

  const handlePrevious = async () => {
    if (!isAdmin || orderedPlayers.length === 0) return;

    const prevIndex = currentIndex === 0 ? orderedPlayers.length - 1 : currentIndex - 1;
    const prevPlayer = orderedPlayers[prevIndex];

    await updateCurrentPlayer(prevPlayer.id);
  };

  const updateCurrentPlayer = async (playerId: string) => {
    // Delete all previous selections
    await supabase
      .from("selected_players")
      .delete()
      .eq("session_id", sessionId);

    // Insert new selection
    await supabase
      .from("selected_players")
      .insert({ session_id: sessionId, player_id: playerId });

    // Update current player
    await supabase
      .from("current_player")
      .update({ player_id: playerId })
      .eq("session_id", sessionId);
  };

  const handleUndo = async () => {
    if (!isAdmin || !lastAssignment) {
      toast.error("Nessuna assegnazione da annullare");
      return;
    }

    // Get participant
    const participant = participants.find(p => p.id === lastAssignment.participant_id);
    if (!participant) return;

    // Restore credits
    await supabase
      .from("participants")
      .update({ credits: participant.credits + lastAssignment.price })
      .eq("id", lastAssignment.participant_id);

    // Delete assignment
    await supabase
      .from("assigned_players")
      .delete()
      .eq("id", lastAssignment.id);

    toast.success("Ultima assegnazione annullata");
    setLastAssignment(null);
  };

  if (!playerDetails) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground text-center">
            Nessun giocatore selezionato
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle className="text-center">Live del Giocatore</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="text-center space-y-4">
          <RoleBadge role={playerDetails.role} className="w-12 h-12 text-2xl" />
          <div>
            <h2 className="text-3xl font-bold">{playerDetails.name}</h2>
            <p className="text-muted-foreground">{playerDetails.team}</p>
          </div>
          <div className="text-5xl font-bold text-primary">
            FVM: {playerDetails.fvm_value}
          </div>
        </div>

        {isAdmin && (
          <div className="w-full max-w-md space-y-3 border-t pt-4">
            {/* Navigation buttons */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePrevious}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Indietro
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleNext}
              >
                Avanti
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona partecipante" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nickname} ({p.credits} crediti)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Prezzo (crediti)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="1"
            />

            <div className="flex gap-2">
              <Button
                variant="success"
                className="flex-1"
                onClick={handleAssign}
              >
                Assegna
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDiscard}
              >
                Scarta
              </Button>
            </div>

            {lastAssignment && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleUndo}
              >
                <Undo className="mr-2 h-4 w-4" />
                Undo
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
