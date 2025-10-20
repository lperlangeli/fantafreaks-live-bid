import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function CreateSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const nickname = location.state?.nickname || "";

  const [numParticipants, setNumParticipants] = useState("8");
  const [budget, setBudget] = useState("500");
  const [auctionOrder, setAuctionOrder] = useState<"alphabetical" | "random">("alphabetical");
  const [startingLetter, setStartingLetter] = useState("A");
  const [isCreating, setIsCreating] = useState(false);
  const [participantNames, setParticipantNames] = useState<string[]>([]);

  // Initialize participant names when number changes
  useEffect(() => {
    const num = parseInt(numParticipants);
    const currentNames = [...participantNames];
    
    // Add admin name at position 0 if not present
    if (currentNames.length === 0 && nickname) {
      currentNames[0] = nickname;
    }
    
    // Adjust array size
    if (currentNames.length < num) {
      // Add empty strings for new participants
      while (currentNames.length < num) {
        currentNames.push("");
      }
    } else if (currentNames.length > num) {
      // Remove excess participants
      currentNames.splice(num);
    }
    
    setParticipantNames(currentNames);
  }, [numParticipants, nickname]);

  const handleParticipantNameChange = (index: number, value: string) => {
    const newNames = [...participantNames];
    newNames[index] = value;
    setParticipantNames(newNames);
  };

  const generateSessionCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateSession = async () => {
    if (!nickname) {
      toast.error("Nickname mancante");
      navigate("/");
      return;
    }

    setIsCreating(true);
    try {
      // Sign in anonymously as admin
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError || !authData.user) {
        toast.error("Errore durante l'autenticazione");
        return;
      }

      const sessionCode = generateSessionCode();

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          session_code: sessionCode,
          admin_id: authData.user.id,
          num_participants: parseInt(numParticipants),
          budget_per_participant: parseInt(budget),
          auction_order: auctionOrder,
          starting_letter: auctionOrder === "alphabetical" ? startingLetter : null,
        })
        .select()
        .single();

      if (sessionError || !session) {
        toast.error("Errore durante la creazione della sessione");
        return;
      }

      // Create ALL participants using the admin's user_id
      // Use provided names or default "Partecipante X"
      const participantsData = participantNames.map((name, index) => ({
        session_id: session.id,
        user_id: authData.user.id,
        nickname: name.trim() || `Partecipante ${index + 1}`,
        credits: parseInt(budget),
        position: index + 1,
      }));

      const { error: participantsError } = await supabase
        .from("participants")
        .insert(participantsData);

      if (participantsError) {
        toast.error("Errore durante la creazione dei partecipanti");
        console.error(participantsError);
        return;
      }

      // Create current_player entry
      await supabase
        .from("current_player")
        .insert({
          session_id: session.id,
          player_id: null,
        });

      toast.success(`Sessione creata! Codice: ${sessionCode}`);
      navigate(`/session/${session.id}`);
    } catch (error) {
      toast.error("Errore imprevisto");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="w-full max-w-2xl space-y-6 animate-fade-in">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Indietro
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Configura Sessione</CardTitle>
            <CardDescription>
              Imposta i parametri per la tua asta fantacalcio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Numero Partecipanti</Label>
              <Select value={numParticipants} onValueChange={setNumParticipants}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[6, 7, 8, 9, 10, 11, 12].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} partecipanti
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Budget per Partecipante</Label>
              <RadioGroup value={budget} onValueChange={setBudget}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="500" id="budget-500" />
                  <Label htmlFor="budget-500">500 crediti</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1000" id="budget-1000" />
                  <Label htmlFor="budget-1000">1000 crediti</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Ordine Asta</Label>
              <RadioGroup 
                value={auctionOrder} 
                onValueChange={(value) => setAuctionOrder(value as "alphabetical" | "random")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="alphabetical" id="order-alpha" />
                  <Label htmlFor="order-alpha">Alfabetico</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="random" id="order-random" />
                  <Label htmlFor="order-random">Random</Label>
                </div>
              </RadioGroup>
            </div>

            {auctionOrder === "alphabetical" && (
              <div className="space-y-2">
                <Label>Lettera di Partenza</Label>
                <Select value={startingLetter} onValueChange={setStartingLetter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
                      <SelectItem key={letter} value={letter}>
                        {letter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nomi Partecipanti</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto p-2 border rounded-lg">
                {participantNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-8">
                      {index + 1}.
                    </span>
                    <Input
                      value={name}
                      onChange={(e) => handleParticipantNameChange(index, e.target.value)}
                      placeholder={index === 0 ? `${nickname} (Admin)` : `Partecipante ${index + 1}`}
                      disabled={index === 0}
                      className={index === 0 ? "bg-muted" : ""}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                L'admin (tu) è il primo partecipante. I nomi non inseriti saranno "Partecipante 2", "Partecipante 3", ecc.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                variant="success"
                onClick={handleCreateSession}
                disabled={isCreating}
                className="flex-1"
              >
                {isCreating ? "Creazione..." : "Crea Sessione"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
