# FantaBuilder

FantaBuilder è un'applicazione web per la gestione di aste fantacalcio in tempo reale. Permette agli amministratori di creare sessioni, gestire giocatori e assegnarli ai partecipanti durante l'asta.

## Funzionalità Principali

### 🎯 Gestione Sessioni
- **Creazione Sessione**: L'admin crea una nuova sessione specificando:
  - Numero di partecipanti (6-12)
  - Budget per partecipante (500 o 1000 crediti)
  - Ordine asta (alfabetico o random)
  - Lettera di partenza (se ordine alfabetico)
  - Nomi dei partecipanti (creati automaticamente)

### 👥 Gestione Partecipanti
- I partecipanti vengono creati automaticamente dall'admin durante la creazione della sessione
- Ogni partecipante ha:
  - Nickname
  - Crediti disponibili
  - Posizione nell'ordine di asta
  - Rosa dei giocatori assegnati

### ⚽ Gestione Giocatori
- **Database Completo**: Oltre 539 giocatori della Serie A 2025/26
- **Filtri**: Per ruolo (Portiere, Difensore, Centrocampista, Attaccante)
- **Ricerca**: Per nome giocatore
- **Selezione Automatica**: 
  - Sistema di ordine giocatori basato su impostazioni asta (alfabetico/random)
  - Ordine salvato in database per persistenza
  - Cambio ruolo permette di rigenerare ordine per nuovo ruolo
  - Dialogo di conferma quando admin cambia ruolo in Gestione
- **Selezione Manuale**: L'admin può selezionare giocatori da:
  - Sezione Gestione (ricerca e filtri)
  - Elenco per Quotazione (click diretto su giocatore)
- **Assegnazione**: L'admin assegna i giocatori ai partecipanti con il prezzo
- **Rimozione**: L'admin può rimuovere giocatori già assegnati, che tornano disponibili per una nuova selezione

### 📊 Visualizzazioni

#### Elenco per Quotazione
- Mostra tutti i giocatori disponibili (non ancora assegnati)
- Filtrato per ruolo attualmente selezionato in Gestione
- Ordinati per FVM (Fanta Valore Medio) decrescente
- Selezionabili direttamente dall'admin
- Aggiornamento in tempo reale

#### Giocatore Live
- Mostra il giocatore attualmente all'asta
- Informazioni dettagliate: nome, squadra, ruolo, FVM
- Possibilità di assegnare il giocatore a un partecipante

#### Formazione
- Visualizzazione della rosa del partecipante
- Organizzata per ruolo
- Calcolo automatico dei crediti spesi

#### Statistiche
- Panoramica della sessione
- Statistiche sui giocatori assegnati
- Distribuzione per ruolo

## Tecnologie Utilizzate

### Frontend
- **React** + **TypeScript**: Framework principale
- **Vite**: Build tool
- **TailwindCSS**: Styling
- **Shadcn/ui**: Componenti UI
- **React Router**: Routing
- **Lucide React**: Icone

### Backend
- **Supabase**: Backend as a Service
  - PostgreSQL database
  - Realtime subscriptions
  - Authentication
  - Row Level Security (RLS)

## Struttura Database

### Tabelle Principali

#### `sessions`
- Sessioni di asta
- Contiene: codice sessione, admin_id, configurazione asta

#### `participants`
- Partecipanti alla sessione
- Contiene: nickname, crediti, posizione, user_id

#### `players`
- Database giocatori
- Contiene: nome, squadra, ruolo, fvm_value

#### `selected_players`
- Giocatori selezionati per l'asta
- Relazione molti-a-molti tra sessions e players

#### `assigned_players`
- Giocatori assegnati ai partecipanti
- Contiene: player_id, participant_id, prezzo, ordine assegnazione

#### `current_player`
- Giocatore corrente all'asta
- Un record per sessione
- Aggiornato automaticamente o manualmente dall'admin

#### `player_order`
- Ordine dei giocatori per la sessione
- Generato all'inizio della sessione o al cambio ruolo
- Basato su configurazione asta (alfabetico/random)
- Permette continuità anche dopo ricaricamento pagina

## Ruoli

### P - Portiere
- Identificato con badge blu
- Codice ruolo: "P"

### D - Difensore
- Identificato con badge verde
- Codice ruolo: "D"

### C - Centrocampista
- Identificato con badge giallo
- Codice ruolo: "C"

### A - Attaccante
- Identificato con badge rosso
- Codice ruolo: "A"

## Flusso di Utilizzo

1. **Creazione Sessione**:
   - Admin accede all'app
   - Inserisce il proprio nickname
   - Configura la sessione (partecipanti, budget, ordine asta)
   - Inserisce i nomi di tutti i partecipanti
   - Sistema crea automaticamente tutti i record necessari

2. **Gestione Asta**:
   - Sistema genera automaticamente ordine giocatori all'inizio
   - Admin può:
     - Seguire ordine automatico proposto dal sistema
     - Selezionare manualmente giocatori da Gestione o Elenco per Quotazione
     - Cambiare ruolo in Gestione (con conferma per rigenerare ordine)
     - Filtrare per ruolo per trovare rapidamente i giocatori
     - Visualizzare l'elenco ordinato per quotazione
     - Assegnare il giocatore al partecipante vincitore con il prezzo
     - Rimuovere giocatori già assegnati dalla sezione Partecipanti

3. **Monitoraggio**:
   - Tutti vedono in tempo reale:
     - Giocatore all'asta
     - Crediti residui dei partecipanti
     - Giocatori assegnati
     - Statistiche sessione

## Funzionalità Realtime

L'applicazione utilizza Supabase Realtime per sincronizzare automaticamente:
- Selezione nuovi giocatori
- Assegnazione giocatori
- Aggiornamento crediti partecipanti
- Cambio giocatore corrente
- Aggiornamento liste e formazioni

## Sicurezza

- Row Level Security (RLS) attivo su tutte le tabelle
- Solo l'admin può modificare i dati della sessione
- Politiche RLS per proteggere i dati sensibili
- Authentication tramite Supabase

## Sviluppo Locale

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev

# Build per produzione
npm run build
```

## Variabili d'Ambiente

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

## Licenza

Progetto proprietario - Tutti i diritti riservati

## Supporto

Per problemi o domande, contattare il team di sviluppo.
