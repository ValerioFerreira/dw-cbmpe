# requirements:
# requests
"""Publica o ETL do DW no Windmill: pasta f/dw, variaveis secretas, scripts,
o flow dw_diario e a agenda dele.

Roda da maquina de quem administra (nao e um script do Windmill). Le tudo de
variaveis de ambiente -- nenhuma credencial neste arquivo:
    WINDMILL_URL, WINDMILL_EMAIL, WINDMILL_PASSWORD   acesso a API
    DATABASE_URL_DW, DATABASE_URL_RESERVA            viram variaveis secretas
                                                     f/dw/database_url_dw e
                                                     f/dw/database_url_reserva

Os scripts sao publicados a partir dos arquivos do repositorio, sem copia
manual: o conteudo e o mesmo, mais um trecho no fim que, dentro do Windmill,
preenche os.environ com as variaveis secretas. Assim o mesmo arquivo roda
na linha de comando e no Windmill.

Idempotente: o que ja existe e atualizado (script ganha versao nova, flow e
agenda sao sobrescritos).

Uso:
    python publicar_dw.py              # publica tudo
    python publicar_dw.py --rodar      # publica e dispara o flow uma vez
"""
import os
import sys
import time
from pathlib import Path

import requests

WORKSPACE = "dgp"
PASTA = "dw"
RAIZ = Path(__file__).resolve().parents[2]

VARIAVEIS = {
    "DATABASE_URL_DW": "Postgres do DW (10.193.1.252:54301). Hoje o superusuario -- trocar por um login com etl_writer.",
    "DATABASE_URL_RESERVA": "Sistema de reserva remunerada (Neon) -- unica fonte em que o Neon e a origem.",
}

ARRAY_TEXTO = {"type": "array", "items": {"type": "string"}, "default": None}

# caminho no Windmill -> (arquivo no repo, resumo, variaveis de ambiente, argumentos)
SCRIPTS = {
    "raw_fdw": ("etl/windmill/dw/raw_fdw.py", "DW raw: fontes Postgres internas via postgres_fdw",
                ["DATABASE_URL_DW"], {"fontes": dict(ARRAY_TEXTO, description="vazio = todas")}),
    "raw_planilhas": ("etl/windmill/dw/raw_planilhas.py", "DW raw: planilhas do Google Sheets",
                      ["DATABASE_URL_DW"], {"planilhas": dict(ARRAY_TEXTO, description="vazio = todas as nao pausadas")}),
    "carga_raw": ("etl/dw/carga_raw.py", "DW raw: fontes via Python (reserva remunerada, no Neon)",
                  ["DATABASE_URL_DW", "DATABASE_URL_RESERVA"], {"fontes": dict(ARRAY_TEXTO, description="ex.: [\"reserva\"]")}),
    "casar_coordenadas_ome": ("etl/sgp/casar_coordenadas_ome.py", "DW stg: coordenadas das OMEs",
                              ["DATABASE_URL_DW"], {"gravar_dw": {"type": "boolean", "default": False},
                                                    "aplicar": {"type": "boolean", "default": False,
                                                                "description": "grava no SGP -- so com revisao humana"}}),
    "carga_core": ("etl/dw/carga_core.py", "DW: stg e core a partir de raw",
                   ["DATABASE_URL_DW"], {}),
    "validar": ("etl/dw/validar.py", "DW: regras de negocio + cargas das ultimas 24h",
                ["DATABASE_URL_DW"], {}),
}

FLOW = "dw_diario"
AGENDA = "dw_diario_agenda"
CRON = "0 30 5 * * *"          # 05:30, todo dia (formato do Windmill: com segundos)
FUSO = "America/Recife"


def carregar_env_local():
    """Preenche os.environ com o .env.local da raiz (gitignored), sem
    sobrescrever o que ja estiver definido. Assim `python publicar_dw.py`
    funciona direto do terminal, sem exportar variavel a mao."""
    arquivo = RAIZ / ".env.local"
    if not arquivo.exists():
        return
    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            chave, valor = linha.split("=", 1)
            os.environ.setdefault(chave.strip(), valor.strip().strip('"'))


def trecho_windmill(variaveis):
    nomes = ", ".join(f'"{v}"' for v in variaveis)
    return f'''

# --- inserido por etl/windmill/publicar_dw.py ------------------------------
# Dentro do Windmill, as credenciais vem das variaveis secretas f/{PASTA}/*,
# com o mesmo nome de variavel de ambiente que o script usa na linha de
# comando. Fora do Windmill este trecho nao existe.
import os as _os
import wmill as _wmill
for _nome in ({nomes},):
    if not _os.environ.get(_nome):
        _os.environ[_nome] = _wmill.get_variable("f/{PASTA}/" + _nome.lower())
'''


def conteudo_para_windmill(arquivo, variaveis):
    texto = (RAIZ / arquivo).read_text(encoding="utf-8")
    # wmill precisa estar nos requirements: com o bloco "# requirements:",
    # o Windmill instala so o que esta listado.
    texto = texto.replace("# requirements:\n", "# requirements:\n# wmill\n", 1)
    return texto + trecho_windmill(variaveis)


class Windmill:
    def __init__(self):
        self.base = "http://" + os.environ["WINDMILL_URL"].removeprefix("http://").removeprefix("https://").rstrip("/")
        r = requests.post(f"{self.base}/api/auth/login", timeout=20, json={
            "email": os.environ["WINDMILL_EMAIL"], "password": os.environ["WINDMILL_PASSWORD"]})
        r.raise_for_status()
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {r.text.strip()}"

    def _url(self, caminho):
        return f"{self.base}/api/w/{WORKSPACE}{caminho}"

    def get(self, caminho, **kw):
        r = self.s.get(self._url(caminho), timeout=60, **kw)
        r.raise_for_status()
        return r.json()

    def post(self, caminho, corpo, ok=(200, 201)):
        r = self.s.post(self._url(caminho), json=corpo, timeout=60)
        if r.status_code not in ok:
            raise RuntimeError(f"POST {caminho}: {r.status_code} {r.text[:300]}")
        return r.text


def esquema(propriedades):
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object",
            "properties": propriedades, "required": []}


def publicar(wm):
    # Pasta
    pastas = {p["name"] for p in wm.get("/folders/list")}
    if PASTA not in pastas:
        wm.post("/folders/create", {"name": PASTA, "summary": "ETL do data warehouse (dw-cbmpe)"})
        print(f"pasta f/{PASTA} criada")

    # Variaveis secretas
    for nome, descricao in VARIAVEIS.items():
        caminho = f"f/{PASTA}/{nome.lower()}"
        valor = os.environ[nome]
        if wm.get(f"/variables/exists/{caminho}"):
            wm.post(f"/variables/update/{caminho}", {"value": valor, "description": descricao})
        else:
            wm.post("/variables/create", {"path": caminho, "value": valor, "is_secret": True,
                                          "description": descricao})
        print(f"variavel {caminho} (secreta)")

    # Scripts
    hashes = {}
    for nome, (arquivo, resumo, variaveis, args) in SCRIPTS.items():
        caminho = f"f/{PASTA}/{nome}"
        corpo = {"path": caminho, "summary": resumo,
                 "description": f"Publicado de {arquivo} por etl/windmill/publicar_dw.py. Nao editar aqui.",
                 "content": conteudo_para_windmill(arquivo, variaveis),
                 "schema": esquema(args), "language": "python3", "kind": "script"}
        if wm.get(f"/scripts/exists/p/{caminho}"):
            corpo["parent_hash"] = wm.get(f"/scripts/get/p/{caminho}")["hash"]
        hashes[caminho] = wm.post("/scripts/create", corpo).strip().strip('"')
        print(f"script {caminho}  <- {arquivo}")

    # Espera o Windmill resolver as dependencias de cada script.
    for caminho, h in hashes.items():
        for _ in range(90):
            st = wm.get(f"/scripts/deployment_status/h/{h}")
            if st.get("lock") is not None or st.get("lock_error_logs"):
                break
            time.sleep(2)
        if st.get("lock_error_logs"):
            raise RuntimeError(f"{caminho}: falha nas dependencias:\n{st['lock_error_logs'][-800:]}")

    # Flow: fontes em paralelo, cada ramo sem derrubar os outros (D8) --
    # o core e montado com o que chegou, e validar.py falha o job se alguma
    # carga das ultimas 24h nao terminou ok.
    def passo(id_, nome, args=None):
        return {"id": id_, "summary": nome, "value": {
            "type": "script", "path": f"f/{PASTA}/{nome}",
            "input_transforms": {k: {"type": "static", "value": v} for k, v in (args or {}).items()}}}

    fluxo = {
        "path": f"f/{PASTA}/{FLOW}",
        "summary": "DW diario: raw -> coordenadas -> core -> validacao",
        "description": "Publicado por etl/windmill/publicar_dw.py. Ordem e racional em etl/windmill/README.md.",
        "schema": esquema({}),
        "value": {"modules": [
            {"id": "raw", "summary": "camada raw, fontes em paralelo", "value": {
                "type": "branchall", "parallel": True, "branches": [
                    {"summary": "Postgres internos (fdw)", "skip_failure": True,
                     "modules": [passo("fdw", "raw_fdw")]},
                    {"summary": "planilhas", "skip_failure": True,
                     "modules": [passo("planilhas", "raw_planilhas")]},
                    {"summary": "reserva (Neon)", "skip_failure": True,
                     "modules": [passo("reserva", "carga_raw", {"fontes": ["reserva"]})]},
                ]}},
            passo("coordenadas", "casar_coordenadas_ome", {"gravar_dw": True}),
            passo("core", "carga_core"),
            passo("validar", "validar"),
        ]},
    }
    if wm.get(f"/flows/exists/{fluxo['path']}"):
        wm.post(f"/flows/update/{fluxo['path']}", fluxo)
    else:
        wm.post("/flows/create", fluxo)
    print(f"flow {fluxo['path']}")

    agenda = {"path": f"f/{PASTA}/{AGENDA}", "schedule": CRON, "timezone": FUSO,
              "script_path": fluxo["path"], "is_flow": True, "args": {}, "enabled": True,
              "summary": "DW diario 05:30"}
    if wm.get(f"/schedules/exists/{agenda['path']}"):
        wm.post(f"/schedules/update/{agenda['path']}",
                {k: agenda[k] for k in ("schedule", "timezone", "args", "summary")})
    else:
        wm.post("/schedules/create", agenda)
    print(f"agenda {agenda['path']}: {CRON} ({FUSO})")
    return fluxo["path"]


def rodar(wm, caminho_flow):
    job = wm.post(f"/jobs/run/f/{caminho_flow}", {}).strip().strip('"')
    print(f"flow disparado: job {job}")
    while True:
        r = wm.get(f"/jobs_u/completed/get_result_maybe/{job}")
        if r.get("completed"):
            print("SUCESSO" if r.get("success") else "FALHA", str(r.get("result"))[:1500])
            return job, r.get("success")
        time.sleep(10)


if __name__ == "__main__":
    carregar_env_local()
    faltando = [v for v in ("WINDMILL_URL", "WINDMILL_EMAIL", "WINDMILL_PASSWORD", *VARIAVEIS)
                if not os.environ.get(v)]
    if faltando:
        sys.exit(f"faltam variaveis (no ambiente ou no .env.local): {', '.join(faltando)}")
    wm = Windmill()
    caminho = publicar(wm)
    if "--rodar" in sys.argv:
        rodar(wm, caminho)
