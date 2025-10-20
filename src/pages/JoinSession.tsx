import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Participant } from "@/types/database";

export default function JoinSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionCode = location.state?.sessionCode || "";
  const sessionId = location.state?.sessionId || "";

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [adminUserId, setAdminUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }
    loadParticipants();
  }, [sessionId]);

  const loadParticipants = async () => {
    const { data: session } = await supabase
      .from("sessions")
      .select("admin_id")
      .eq("id", sessionId)
      .single();

    if (session) {
      setAdminUserId(session.admin_id);
    }

    const { data } = await supabase
      .from("participants")
      .select("*")
      .eq("session_id", sessionId)
      .order("position");

    if (data) {
      setParticipants(data as Participant[]);
    }
  };

  const handleSelectParticipant = async (participant: Participant) => {
    // Check if this participant slot is already taken by someone else
    if (participant.user_id !== adminUserId) {
      toast.error("Questa squadra è già stata presa da un altro giocatore");
      return;
    }

    setIsLoading(true);
    try {
      // Sign in anonymously
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError || !authData.user) {
        toast.error("Errore durante l'autenticazione");
        return;
      }

      // Update participant with new user_id
      const { error: updateError } = await supabase
        .from("participants")
        .update({ user_id: authData.user.id })
        .eq("id", participant.id);

      if (updateError) {
        toast.error("Errore durante la selezione della squadra");
        return;
      }

      toast.success(`Ti sei unito come ${participant.nickname}!`);
      navigate(`/session/${sessionId}`);
    } catch (error) {
      toast.error("Errore imprevisto");
    } finally {
      setIsLoading(false);
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
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Scegli la tua squadra
            </CardTitle>
            <CardDescription>
              Codice sessione: <span className="font-mono font-bold text-primary">{sessionCode}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {participants.map((participant) => {
                const isAvailable = participant.user_id === adminUserId;
                
                return (
                  <button
                    key={participant.id}
                    onClick={() => handleSelectParticipant(participant)}
                    disabled={!isAvailable || isLoading}
                    className={`w-full p-4 rounded-lg border-2 transition-all ${
                      isAvailable
                        ? "border-primary/50 hover:border-primary hover:bg-accent cursor-pointer"
                        : "border-muted bg-muted/50 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{participant.nickname}</span>
                          {!isAvailable && (
                            <Badge variant="secondary" className="text-xs">
                              Occupata
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Posizione {participant.position} • {participant.credits} crediti
                        </p>
                      </div>
                      {isAvailable && (
                        <Badge variant="outline" className="text-sm">
                          Disponibile
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
