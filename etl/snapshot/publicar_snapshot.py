"""Publica o snapshot do DW para o app da Vercel (enquanto o deploy interno nao existe).

O que faz, nesta ordem:
  1. gera os arquivos com backend/scripts/gerar_snapshot.js (le o DW; precisa da rede do
     DW e de backend/.env) -- sem nome completo, CPF, telefone, licencas nominais nem
     oficio/SEI de Financas;
  2. cria uma copia temporaria do codigo no COMMIT ATUAL (HEAD) e poe os arquivos em
     public/snapshot/ dessa copia;
  3. faz um commit nela e envia, com push forcado, para a branch `vercel` do GitHub.

A branch `vercel` e descartavel: a cada publicacao ela e refeita a partir do HEAD + o
snapshot, entao a `main` nunca recebe os arquivos (public/snapshot/ esta no .gitignore) e o
historico nao cresce com 30 MB por dia. A Vercel precisa ter a `vercel` como "Production
Branch" (Settings > Git); o proprio push dispara o deploy.

O que vai para o commit e o HEAD: commite antes o que quiser ver publicado.

Uso:
    python etl/snapshot/publicar_snapshot.py              # gera e publica
    python etl/snapshot/publicar_snapshot.py --sem-push   # gera e deixa o commit local na branch vercel
"""
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
BRANCH = "vercel"


def rodar(cmd, cwd=RAIZ, **kw):
    print("  $", " ".join(str(c) for c in cmd))
    return subprocess.run(cmd, cwd=cwd, check=True, **kw)


def main():
    sem_push = "--sem-push" in sys.argv
    with tempfile.TemporaryDirectory(prefix="cbmpe_snapshot_") as tmp:
        tmp = Path(tmp)
        arquivos = tmp / "arquivos"
        print("1. Gerando o snapshot a partir do DW")
        rodar(["node", "scripts/gerar_snapshot.js", str(arquivos)], cwd=RAIZ / "backend")

        copia = tmp / "codigo"
        print("2. Copia do commit atual + snapshot")
        rodar(["git", "worktree", "add", "--detach", str(copia), "HEAD"])
        try:
            destino = copia / "public" / "snapshot"
            shutil.copytree(arquivos, destino)
            rodar(["git", "checkout", "-B", BRANCH], cwd=copia)
            rodar(["git", "add", "-f", "public/snapshot"], cwd=copia)
            rodar(["git", "commit", "-q", "-m", f"Snapshot {datetime.now():%d/%m/%Y %H:%M}"], cwd=copia)
            if sem_push:
                print(f"\nCommit criado na branch local `{BRANCH}` (sem push).")
            else:
                print("3. Enviando para o GitHub")
                rodar(["git", "push", "--force", "origin", BRANCH], cwd=copia)
                print(f"\nPublicado na branch `{BRANCH}`. A Vercel faz o deploy sozinha se ela for a Production Branch.")
        finally:
            subprocess.run(["git", "worktree", "remove", "--force", str(copia)], cwd=RAIZ, check=False)


if __name__ == "__main__":
    main()
