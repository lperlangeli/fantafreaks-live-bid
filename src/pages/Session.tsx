import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Session as SessionType, Participant, Player, CurrentPlayer, Role } from "@/types/database";
import PlayerManagement from "@/components/PlayerManagement";
import FormationSection from "@/components/FormationSection";
import StatisticsSection from "@/components/StatisticsSection";
import LivePlayer from "@/components/LivePlayer";
import PlayerList from "@/components/PlayerList";
import ParticipantsList from "@/components/ParticipantsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Session() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionType | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<CurrentPlayer | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userParticipant, setUserParticipant] = useState<Participant | null>(null);
  const [selectedRole, setSelectedRole] = useState<"P" | "D" | "C" | "A" | "ALL">("ALL");
  const [showRoleChangeDialog, setShowRoleChangeDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPlayerDetails, setCurrentPlayerDetails] = useState<Player | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError || !sessionData) {
        toast.error("Sessione non trovata");
        navigate("/");
        return;
      }

      setSession(sessionData as SessionType);
      setIsAdmin(user?.id === sessionData.admin_id);

      // Load participants
      const { data: participantsData } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", sessionId)
        .order("position");

      if (participantsData) {
        setParticipants(participantsData as Participant[]);
        const userPart = participantsData.find(p => p.user_id === user?.id);
        setUserParticipant(userPart as Participant || null);
      }

      // Load current player
      const { data: currentPlayerData } = await supabase
        .from("current_player")
        .select("*")
        .eq("session_id", sessionId)
        .single();

      if (currentPlayerData) {
        setCurrentPlayer(currentPlayerData as CurrentPlayer);
        // Load player details
        if (currentPlayerData.player_id) {
          const { data: playerData } = await supabase
            .from("players")
            .select("*")
            .eq("id", currentPlayerData.player_id)
            .single();
          if (playerData) {
            setCurrentPlayerDetails(playerData as Player);
          }
        }
      }
      
      // If admin, check if we need to initialize player order
      if (user?.id === sessionData.admin_id) {
        const { data: orderExists } = await supabase
          .from("player_order")
          .select("id")
          .eq("session_id", sessionId)
          .limit(1);

        if (!orderExists || orderExists.length === 0) {
          await initializePlayerOrder(sessionData);
        }
      }
    };

    const initializePlayerOrder = async (sessionData: SessionType) => {
      console.log('Initializing player order for session:', sessionData.id);
      
      // Generate and save player order
      const { data: allPlayers } = await supabase
        .from("players")
        .select("*");

      console.log('All players fetched:', allPlayers?.length);

      if (!allPlayers || allPlayers.length === 0) return;

      let orderedPlayers: Player[] = [];

      if (sessionData.auction_order === 'alphabetical') {
        console.log('Using alphabetical order');
        const roleOrder = { 'P': 0, 'D': 1, 'C': 2, 'A': 3 };
        const sortedByRole = (allPlayers as Player[]).sort((a, b) => {
          const roleComparison = roleOrder[a.role] - roleOrder[b.role];
          if (roleComparison !== 0) return roleComparison;
          return a.name.localeCompare(b.name);
        });

        if (sessionData.starting_letter) {
          const startLetter = sessionData.starting_letter.toUpperCase();
          const roles: ('P' | 'D' | 'C' | 'A')[] = ['P', 'D', 'C', 'A'];
          roles.forEach(role => {
            const playersOfRole = sortedByRole.filter(p => p.role === role);
            const startIndex = playersOfRole.findIndex(p => p.name.charAt(0).toUpperCase() >= startLetter);
            if (startIndex !== -1) {
              orderedPlayers = [...orderedPlayers, ...playersOfRole.slice(startIndex), ...playersOfRole.slice(0, startIndex)];
            } else {
              orderedPlayers = [...orderedPlayers, ...playersOfRole];
            }
          });
        } else {
          orderedPlayers = sortedByRole;
        }
      } else if (sessionData.auction_order === 'random') {
        console.log('Using random order');
        const roles: ('P' | 'D' | 'C' | 'A')[] = ['P', 'D', 'C', 'A'];
        roles.forEach(role => {
          const playersOfRole = (allPlayers as Player[]).filter(p => p.role === role);
          for (let i = playersOfRole.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playersOfRole[i], playersOfRole[j]] = [playersOfRole[j], playersOfRole[i]];
          }
          orderedPlayers = [...orderedPlayers, ...playersOfRole];
        });
      }

      console.log('Ordered players created:', orderedPlayers.length);

      // Save order to database
      const orderData = orderedPlayers.map((player, index) => ({
        session_id: sessionData.id,
        player_id: player.id,
        order_index: index
      }));

      const { error: insertError } = await supabase
        .from("player_order")
        .insert(orderData);

      console.log('Player order inserted, error:', insertError);

      // Set first player
      if (orderedPlayers.length > 0) {
        const firstPlayer = orderedPlayers[0];
        console.log('Setting first player:', firstPlayer.name);
        
        await supabase
          .from("current_player")
          .update({ player_id: firstPlayer.id })
          .eq("session_id", sessionId);

        await supabase
          .from("selected_players")
          .delete()
          .eq("session_id", sessionId);

        await supabase
          .from("selected_players")
          .insert({ session_id: sessionId!, player_id: firstPlayer.id });
      }
    };

    loadSession();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`session_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadSession();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "current_player",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadSession();
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
          loadSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate]);

  // Update current player details when currentPlayer changes
  useEffect(() => {
    if (currentPlayer?.player_id) {
      const loadPlayerDetails = async () => {
        const { data: playerData } = await supabase
          .from("players")
          .select("*")
          .eq("id", currentPlayer.player_id)
          .single();
        if (playerData) {
          setCurrentPlayerDetails(playerData as Player);
        }
      };
      loadPlayerDetails();
    } else {
      setCurrentPlayerDetails(null);
    }
  }, [currentPlayer]);

  const handleRoleChange = (role: Role) => {
    if (!isAdmin) {
      setSelectedRole(role);
      return;
    }

    setPendingRole(role);
    setShowRoleChangeDialog(true);
  };

  const handleRoleChangeConfirm = async () => {
    if (!pendingRole || !session) return;

    setSelectedRole(pendingRole);
    
    // Delete existing player order
    await supabase
      .from("player_order")
      .delete()
      .eq("session_id", sessionId!);

    // Reinitialize with new role-based order
    await initializePlayerOrderForRole(session, pendingRole);
    
    setShowRoleChangeDialog(false);
    setPendingRole(null);
    toast.success(`Iniziata selezione giocatori ruolo ${pendingRole}`);
  };

  const handleRoleChangeCancel = () => {
    if (pendingRole) {
      setSelectedRole(pendingRole);
    }
    setShowRoleChangeDialog(false);
    setPendingRole(null);
  };

  const initializePlayerOrderForRole = async (sessionData: SessionType, role: Role) => {
    const { data: allPlayers } = await supabase
      .from("players")
      .select("*")
      .eq("role", role);

    if (!allPlayers || allPlayers.length === 0) return;

    let orderedPlayers: Player[] = [];

    if (sessionData.auction_order === 'alphabetical') {
      orderedPlayers = (allPlayers as Player[]).sort((a, b) => a.name.localeCompare(b.name));
      
      if (sessionData.starting_letter) {
        const startLetter = sessionData.starting_letter.toUpperCase();
        const startIndex = orderedPlayers.findIndex(p => p.name.charAt(0).toUpperCase() >= startLetter);
        if (startIndex !== -1) {
          orderedPlayers = [...orderedPlayers.slice(startIndex), ...orderedPlayers.slice(0, startIndex)];
        }
      }
    } else if (sessionData.auction_order === 'random') {
      orderedPlayers = [...allPlayers as Player[]];
      for (let i = orderedPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [orderedPlayers[i], orderedPlayers[j]] = [orderedPlayers[j], orderedPlayers[i]];
      }
    }

    const orderData = orderedPlayers.map((player, index) => ({
      session_id: sessionData.id,
      player_id: player.id,
      order_index: index
    }));

    await supabase
      .from("player_order")
      .insert(orderData);

    if (orderedPlayers.length > 0) {
      const firstPlayer = orderedPlayers[0];
      
      await supabase
        .from("current_player")
        .update({ player_id: firstPlayer.id })
        .eq("session_id", sessionId);

      await supabase
        .from("selected_players")
        .delete()
        .eq("session_id", sessionId);

      await supabase
        .from("selected_players")
        .insert({ session_id: sessionId!, player_id: firstPlayer.id });
    }
  };

  // Mobile navigation functions
  const [orderedPlayers, setOrderedPlayers] = useState<Player[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Load ordered players for mobile navigation
  useEffect(() => {
    if (!sessionId) return;

    const loadOrderedPlayers = async () => {
      const { data: orderData } = await supabase
        .from("player_order")
        .select("player_id")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: true });

      if (orderData && orderData.length > 0) {
        const playerIds = orderData.map(o => o.player_id);
        const { data: players } = await supabase
          .from("players")
          .select("*")
          .in("id", playerIds);

        if (players) {
          const orderedPlayersList = playerIds
            .map(id => (players as Player[]).find(p => p.id === id))
            .filter(p => p !== undefined) as Player[];
          setOrderedPlayers(orderedPlayersList);
        }
      }
    };

    loadOrderedPlayers();

    // Subscribe to player_order changes
    const channel = supabase
      .channel(`mobile_player_order_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_order",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadOrderedPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Update current index when current player changes
  useEffect(() => {
    if (currentPlayer?.player_id && orderedPlayers.length > 0) {
      const index = orderedPlayers.findIndex(p => p.id === currentPlayer.player_id);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [currentPlayer, orderedPlayers]);

  const handlePreviousPlayer = async () => {
    if (!isAdmin || orderedPlayers.length === 0) return;

    const prevIndex = currentIndex === 0 ? orderedPlayers.length - 1 : currentIndex - 1;
    const prevPlayer = orderedPlayers[prevIndex];

    await updateCurrentPlayer(prevPlayer.id);
  };

  const handleNextPlayer = async () => {
    if (!isAdmin || orderedPlayers.length === 0) return;

    const nextIndex = (currentIndex + 1) % orderedPlayers.length;
    const nextPlayer = orderedPlayers[nextIndex];

    await updateCurrentPlayer(nextPlayer.id);
  };

  const updateCurrentPlayer = async (playerId: string) => {
    // Delete all previous selections
    await supabase
      .from("selected_players")
      .delete()
      .eq("session_id", sessionId!);

    // Insert new selection
    await supabase
      .from("selected_players")
      .insert({ session_id: sessionId!, player_id: playerId });

    // Update current player
    await supabase
      .from("current_player")
      .update({ player_id: playerId })
      .eq("session_id", sessionId!);
  };

  const handleAssignPlayer = async () => {
    if (!currentPlayerDetails || !selectedParticipantId || !price) {
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
      .eq("session_id", sessionId!)
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
        if ((roleCounts[currentPlayerDetails.role] || 0) >= limits[currentPlayerDetails.role]) {
          toast.error(`Limite raggiunto per ruolo ${currentPlayerDetails.role}`);
          return;
        }
      }
    }

    // Get assignment order
    const { data: assignedCount } = await supabase
      .from("assigned_players")
      .select("id", { count: "exact" })
      .eq("session_id", sessionId!);

    const assignmentOrder = (assignedCount?.length || 0) + 1;

    // Assign player
    const { error: assignError } = await supabase
      .from("assigned_players")
      .insert({
        session_id: sessionId!,
        participant_id: selectedParticipantId,
        player_id: currentPlayerDetails.id,
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

    toast.success(`${currentPlayerDetails.name} assegnato a ${participant.nickname}!`);
    setSelectedParticipantId("");
    setPrice("");
    setShowAssignDialog(false);
    
    // Move to next player
    handleNextPlayer();
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      {/* Mobile Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-primary">FB</div>
            <div>
              <h1 className="font-bold text-lg">FantaBuilder</h1>
              <p className="text-xs text-muted-foreground">
                Codice: <span className="font-mono font-bold text-primary">{session.session_code}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-medium">{userParticipant?.nickname}</p>
              {isAdmin && (
                <p className="text-xs text-primary font-semibold">Admin</p>
              )}
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Menu</h2>
                  <div className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setMobileMenuOpen(false)}>
                      Listone (ex Gestione)
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setMobileMenuOpen(false)}>
                      Elenco x quotazione
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setMobileMenuOpen(false)}>
                      Formazione (coming soon)
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setMobileMenuOpen(false)}>
                      Statistiche (coming soon)
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setMobileMenuOpen(false)}>
                      Partecipanti
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Mobile Layout */}
      <div className="flex flex-col min-h-screen">
        {/* Live Player Section - Fixed */}
        <div className="bg-card border-b p-4">
          {currentPlayerDetails ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold">{currentPlayerDetails.name}</span>
                <span className="text-sm text-muted-foreground">{currentPlayerDetails.team}</span>
                <span className="text-lg font-bold text-primary">{currentPlayerDetails.fvm_value}</span>
              </div>
              
              {/* Admin Navigation Buttons */}
              {isAdmin && (
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="icon" onClick={handlePreviousPlayer}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowAssignDialog(true)}
                  >
                    Assegna
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleNextPlayer}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Nessun giocatore selezionato
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-4">
          <div className="space-y-6">
            {/* Gestione Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Listone (ex Gestione)</h3>
              <PlayerManagement 
                sessionId={session.id} 
                isAdmin={isAdmin}
                onRoleChange={handleRoleChange}
              />
            </div>

            {/* Elenco per Quotazione */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Elenco x quotazione</h3>
              <PlayerList sessionId={session.id} selectedRole={selectedRole} isAdmin={isAdmin} />
            </div>

            {/* Formazione */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Formazione (coming soon)</h3>
              <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
                <p>Formazione in arrivo...</p>
              </div>
            </div>

            {/* Statistiche */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Statistiche (coming soon)</h3>
              <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
                <p>Statistiche in arrivo...</p>
              </div>
            </div>

            {/* Partecipanti */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Partecipanti</h3>
              <ParticipantsList
                sessionId={session.id}
                participants={participants}
                currentUserId={currentUser?.id}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna {currentPlayerDetails?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Partecipante</label>
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
            </div>
            <div>
              <label className="text-sm font-medium">Prezzo (crediti)</label>
              <Input
                type="number"
                placeholder="Inserisci prezzo"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleAssignPlayer}>
              Assegna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={showRoleChangeDialog} onOpenChange={setShowRoleChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiare ruolo?</AlertDialogTitle>
            <AlertDialogDescription>
              Iniziare a chiamare giocatori del nuovo ruolo selezionato?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRoleChangeCancel}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChangeConfirm}>Sì</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
