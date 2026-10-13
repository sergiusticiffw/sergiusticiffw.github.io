# Dosar medical

Dosar medical personal pentru familie. Un cont de administrator gestionează toate profilurile. Documentele scanate completează consultațiile și analizele după IDNP.

## Pornire locală

```bash
cp .env.example .env.local
pnpm dev
```

Completează `.env.local` cu adresa proiectului Supabase și cheia anonimă. Nu adăuga cheia `service_role` în acest proiect: accesul la date trece prin sesiunea utilizatorului și prin politicile RLS.

Clientul OAuth Google și cheia de criptare rămân doar pe server. Nu le prefixa cu `NEXT_PUBLIC_`.

## Proiect Supabase

1. Creează proiectul în regiunea UE, de exemplu Frankfurt.
2. În Authentication → URL Configuration, setează Site URL la `http://localhost:3000` și adaugă redirect-ul `http://localhost:3000/auth/callback`.
3. Lasă înscrierea publică oprită. Creează primul utilizator din Authentication → Users. La inserare, migrația creează familia „Familia mea” și îl marchează administrator.
4. Activează MFA și limitele de încercări la autentificare din dashboard.
5. Pentru emailuri de recuperare în producție, configurează un SMTP propriu. Serviciul implicit de email are limite mici.
6. Aplică [`supabase/migrations/20261013120000_init_medical.sql`](supabase/migrations/20261013120000_init_medical.sql) din SQL Editor, sau cu Supabase CLI: `supabase link` apoi `supabase db push`.

Rolurile `editor` și `viewer` există în schemă, dar nu au politici. Un cont cu aceste roluri nu vede date. Fiecare cont nou primește propria familie și nu vede profilurile altui cont.

## Fișiere în Google Drive

Supabase păstrează utilizatorii, profilurile, consultațiile, analizele și metadatele documentelor. PDF-urile și fotografiile stau într-un folder privat din My Drive, în spațiul Google pe care îl ai deja. Drive nu înlocuiește autentificarea și nici baza de date.

Pentru un cont Google personal, aplicația folosește OAuth 2.0 al contului tău și un folder creat de aplicație în My Drive. Nu folosi un service account ca proprietar al fișierelor și nu partaja folderul cu „Anyone with the link”.

1. În Google Cloud, creează un client OAuth de tip aplicație web. Adaugă redirect-ul `http://localhost:3000/api/google/callback` și, la lansare, adresa de producție.
2. În ecranul de consimțământ, lasă aplicația în modul de testare și adaugă contul Google al familiei ca utilizator de test. Permisiunea folosită este `drive.file`: aplicația vede doar fișierele pe care le creează ea.
3. Generează cheia de criptare cu `openssl rand -base64 32` și pune-o în `GOOGLE_TOKEN_ENCRYPTION_KEY`.
4. Pune `GOOGLE_CLIENT_ID` și `GOOGLE_CLIENT_SECRET` în `.env.local`.
5. După autentificare, folosește „Conectează Google Drive”. Tokenul de reîmprospătare este criptat și salvat în baza de date. Browserul nu îl primește.

La scanare, Next.js trimite fotografia sau PDF-ul către Gemini ca să copieze câmpurile tipărite. Nu se pune un diagnostic și nu se inventează valori. Persoana este profilul a cărui IDNP coincide cu numărul din document. Dacă IDNP-ul lipsește sau nu există în familie, fișierul nu se urcă. După ce verifici câmpurile, serverul urcă fișierul în folderul privat al acelei persoane și salvează consultația sau analizele. Ștergerea documentului șterge și rândurile create din el.

Creează `GEMINI_API_KEY` în Google AI Studio și pune-o doar în `.env`. Cheia nu ajunge în browser. Aplică mai întâi migrația inițială, apoi [`supabase/migrations/20261013140000_idnp_extraction.sql`](supabase/migrations/20261013140000_idnp_extraction.sql).

La deschidere, `/api/documents/[id]` verifică din nou accesul și trimite conținutul prin aplicație, fără un link public. Tipurile permise sunt PDF, JPEG, PNG și WebP, recunoscute după conținut, cu limită de 10 MB.

Nu urca documente medicale până nu verifici izolarea: un al doilea utilizator, autentificat în propria familie, nu trebuie să vadă profilurile primului și nu trebuie să poată deschide documentele lui.

Planul gratuit Supabase are 500 MB pentru baza de date. Proiectele inactive pot fi puse în pauză, iar planul gratuit nu include backup automat. Utilizarea obișnuită a Google Drive API nu are un cost separat, în limitele contului. Păstrează o copie locală criptată a bazei și a fișierelor, apoi testează restaurarea. Furnizorul cloud nu este singura copie a datelor.
