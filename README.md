# DataTraverse — Hospitals DB (GitHub Pages + Supabase)

Ce projet est un front statique (GitHub Pages) qui synchronise des établissements via une DB centrale Supabase.

## 1) Créer un projet Supabase
- Crée un projet Supabase
- Va dans **Project Settings → API**
- Copie:
  - `Project URL` => SUPABASE_URL
  - `anon public` key => SUPABASE_ANON_KEY

Puis mets-les dans `app.js`.

## 2) Créer la table
Dans Supabase → SQL Editor, exécute:

```sql
create table if not exists hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null,
  country text not null,
  city text not null,
  category text not null,
  speciality text,
  website text,
  email text,
  telephone text,
  teleconsultation text default 'NO',
  created_at timestamptz default now()
);
