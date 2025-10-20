import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinSession = async () => {
    if (!sessionCode.trim()) {
      toast.error("Inserisci il codice sessione");
      return;
    }

    setIsLoading(true);
    try {
      // Verify session exists
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("session_code", sessionCode.toUpperCase())
        .single();

      if (sessionError || !session) {
        toast.error("Sessione non trovata");
        return;
      }

      // Navigate to join session page to choose team
      navigate("/join-session", { 
        state: { 
          sessionCode: sessionCode.toUpperCase(),
          sessionId: session.id 
        } 
      });
    } catch (error) {
      toast.error("Errore imprevisto");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = () => {
    if (!nickname.trim()) {
      toast.error("Inserisci un nickname");
      return;
    }
    navigate("/create-session", { state: { nickname } });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <img src={logo} alt="FantaBuilder" className="h-32 mx-auto" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            FantaBuilder
          </h1>
          <p className="text-muted-foreground">Gestione aste fantacalcio in tempo reale</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Benvenuto</CardTitle>
            <CardDescription>Crea una nuova sessione o unisciti ad una esistente</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="join" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="join">Unisciti</TabsTrigger>
                <TabsTrigger value="create">Crea</TabsTrigger>
              </TabsList>

              <TabsContent value="join" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Codice Sessione</label>
                  <Input
                    placeholder="Es: B8Z90G"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleJoinSession}
                  disabled={isLoading}
                >
                  {isLoading ? "Connessione..." : "Continua"}
                </Button>
              </TabsContent>

              <TabsContent value="create" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nickname Admin</label>
                  <Input
                    placeholder="Il tuo nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                  />
                </div>
                <Button 
                  className="w-full" 
                  variant="success"
                  onClick={handleCreateSession}
                >
                  Crea Sessione
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
