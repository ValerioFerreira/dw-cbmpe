# requirements:
# Pillow
"""Copia para public/insignias/ apenas os PNG de insignia usados pelo app.

O repositorio de insignias que o usuario enviou tem 280 arquivos (.cdr, .pdf
e .png de brevês, distintivos, secoes, CATs...) e fica FORA do commit -- so
os PNG das unidades que o app realmente desenha entram no repositorio.

O nome da pasta de origem varia (`1ºGB`, `CENTRO DE INTELIGENCIA`,
`DINTER-1`), e o do arquivo dentro dela tambem (`AJ/ASSESSORIA JURIDICA.png`).
Por isso o de-para abaixo e explicito: e mais curto que a heuristica que
acertaria os mesmos casos, e falha alto quando uma unidade nova aparece.

O nome de destino e a sigla do organograma, sanitizada para caber numa URL
(`CAT/RMR` -> `CAT-RMR`) -- ver siglaParaArquivo em src/lib/insignias.js.

Uso:
    python etl/_geo/copiar_insignias.py            # relatorio
    python etl/_geo/copiar_insignias.py --copiar   # copia de fato
"""
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "public" / "insignias"

# sigla do organograma -> (subpasta do repositorio, nome do PNG sem extensao)
INSIGNIAS = {
    # Grupamentos -- os unicos que aparecem no mapa
    "1º GB": ("GRUPAMENTOS/1ºGB", "1ºGB"),
    "2º GB": ("GRUPAMENTOS/2ºGB", "2ºGB"),
    "3º GB": ("GRUPAMENTOS/3ºGB", "3ºGB"),
    "4º GB": ("GRUPAMENTOS/4ºGB", "4ºGB"),
    "5º GB": ("GRUPAMENTOS/5ºGB", "5ºGB"),
    "6º GB": ("GRUPAMENTOS/6ºGB", "6ºGB"),
    "7º GB": ("GRUPAMENTOS/7ºGB", "7ºGB"),
    "9º GB": ("GRUPAMENTOS/9ºGB", "9ºGB"),
    "GBI": ("GRUPAMENTOS/GBI", "GBI"),
    "GBS": ("GRUPAMENTOS/GBS", "GBS"),
    "GBMar": ("GRUPAMENTOS/GBMAR", "GBMAR"),
    "GBAPH": ("GRUPAMENTOS/GBAPH", "GBAPH"),
    "ABMG": ("GRUPAMENTOS/ABMG", "ABMG"),
    # CATs
    "CAT/RMR": ("CATS/CAT RMR", "CAT RMR"),
    "CAT/ZM": ("CATS/CAT ZM", "CAT ZM"),
    "CAT/AG": ("CATS/CAT AGRESTE I", "CAT AGRESTE I"),
    "CAT/SE": ("CATS/CAT SERTÃO 1", "CAT SERTÃO 1"),
    # Diretorias, centros e assessorias
    "AECI": ("DIRETORIAS-CENTROS/AECI", "AECI"),
    "AJG": ("DIRETORIAS-CENTROS/AJG", "AJG"),
    "CCS": ("DIRETORIAS-CENTROS/CCS", "CCS"),
    "CEAO": ("DIRETORIAS-CENTROS/CEAO", "CEAO"),
    "CEFD": ("DIRETORIAS-CENTROS/CEFD", "CEFD"),
    "CI": ("DIRETORIAS-CENTROS/CENTRO DE INTELIGÊNCIA", None),
    "CINT": ("DIRETORIAS-CENTROS/CINT", "CINT"),
    "CMAN": ("DIRETORIAS-CENTROS/CMAN", "CMAN"),
    "DAS": ("DIRETORIAS-CENTROS/DAS", "DAS"),
    "DEIP": ("DIRETORIAS-CENTROS/DEIP", "DEIP"),
    "DF": ("DIRETORIAS-CENTROS/DF", "DF"),
    "DGO": ("DIRETORIAS-CENTROS/DGO", "DGO"),
    "DGP": ("DIRETORIAS-CENTROS/DGP", "DGP"),
    "DIESP": ("DIRETORIAS-CENTROS/DIESP", "DIESP"),
    "DIM": ("DIRETORIAS-CENTROS/DIM", "DIM"),
    "DINTER I": ("DIRETORIAS-CENTROS/DINTER-1", None),
    "DINTER II": ("DIRETORIAS-CENTROS/DINTER-2", None),
    "DJD": ("DIRETORIAS-CENTROS/DJD", "DJD"),
    "DLOG": ("DIRETORIAS-CENTROS/DLOG", "DLOG"),
    "DPLAG": ("DIRETORIAS-CENTROS/DPLAG", "DPLAG"),
    "DTIC": ("DIRETORIAS-CENTROS/DTIC", "DTIC"),
    "DVP": ("DIRETORIAS-CENTROS/DVP", None),
    # Brasao da corporacao: usado no QCG (no mapa) e nas unidades de topo,
    # que nao tem insignia propria.
    "CBMPE": ("SEGURANÇA PÚBLICA/SDS/CBMPE", "CBMPE"),
}

# Unidades de topo e orgaos sem insignia propria caem no brasao.
USA_BRASAO = ["COMANDO GERAL", "SUBCOMANDO GERAL", "GCG", "GSG", "CPO", "CPP", "DGA"]


def achar_repositorio():
    """A pasta enviada pelo usuario, na raiz do projeto. O nome tem
    acentuacao decomposta (NFD) em disco, entao a busca e por prefixo."""
    def parece(nome):
        return unicodedata.normalize("NFC", nome).startswith("CBMPE - Reposit")

    for p in sorted(RAIZ.iterdir()):
        if not (p.is_dir() and parece(p.name)):
            continue
        # O zip do Drive vem com a pasta dentro de outra de mesmo nome, e o
        # nome em disco esta com acentuacao decomposta (NFD) -- comparar
        # string montada aqui nao casa, entao a busca e por listagem.
        internas = [d for d in p.iterdir() if d.is_dir() and parece(d.name)]
        return internas[0] if internas else p
    return None


# O app desenha a insignia com 20px (balao do mapa) a 44px (topo da pagina da
# unidade). 256 cobre telas de alta densidade com folga.
LADO_MAX = 256


def reduzir(origem, destino):
    """Copia reduzindo para no maximo LADO_MAX de lado, preservando a
    transparencia. Devolve o tamanho gravado."""
    from PIL import Image
    with Image.open(origem) as img:
        img = img.convert("RGBA")
        img.thumbnail((LADO_MAX, LADO_MAX), Image.LANCZOS)
        img.save(destino, "PNG", optimize=True)
    return destino.stat().st_size


def sigla_para_arquivo(sigla):
    """Sigla -> nome de arquivo seguro em URL. Espelhado em
    src/lib/insignias.js -- mudou aqui, muda la."""
    limpa = unicodedata.normalize("NFKD", sigla).encode("ascii", "ignore").decode()
    return "".join(c if c.isalnum() else "-" for c in limpa).strip("-").replace("--", "-")


def resolver(base, subcaminho):
    """Desce um caminho comparando os nomes em NFC -- em disco eles estao em
    NFD, entao `base / "SEGURANÇA PÚBLICA"` simplesmente nao existe."""
    atual = base
    for parte in subcaminho.split("/"):
        alvo = unicodedata.normalize("NFC", parte)
        achado = next((d for d in atual.iterdir()
                       if unicodedata.normalize("NFC", d.name) == alvo), None)
        if achado is None:
            return atual / parte
        atual = achado
    return atual


def png_da_pasta(pasta, nome):
    if not pasta.is_dir():
        return None
    if nome:
        alvo = unicodedata.normalize("NFC", f"{nome}.png")
        achado = next((p for p in pasta.iterdir()
                       if unicodedata.normalize("NFC", p.name) == alvo), None)
        if achado:
            return achado
    # nome do arquivo diverge do nome da pasta (ex. AJ/ASSESSORIA JURÍDICA.png)
    pngs = sorted(p for p in pasta.iterdir() if p.suffix.lower() == ".png")
    return pngs[0] if pngs else None


def main():
    repo = achar_repositorio()
    if repo is None:
        raise SystemExit(
            "Pasta 'CBMPE - Repositório de Insígnias...' não encontrada na raiz do projeto. "
            "Ela fica fora do commit — recoloque-a para reexecutar este script."
        )
    print(f"Repositório: {repo.relative_to(RAIZ)}")

    copiar = "--copiar" in sys.argv
    if copiar:
        DESTINO.mkdir(parents=True, exist_ok=True)

    encontrados, faltando = [], []
    for sigla, (subpasta, nome) in INSIGNIAS.items():
        origem = png_da_pasta(resolver(repo, subpasta), nome)
        if origem is None:
            faltando.append((sigla, subpasta))
            continue
        arquivo = f"{sigla_para_arquivo(sigla)}.png"
        destino = DESTINO / arquivo
        # Reduzido na copia: o original tem ate 2,6 MB (arte vetorial
        # rasterizada em alta), e o app desenha isto com 20 a 44 px. Servir
        # 10 MB de PNG por causa de icone de 32 px seria desperdicio puro --
        # e sao servidos de public/, sem passar por build.
        tamanho = reduzir(origem, destino) if copiar else origem.stat().st_size
        encontrados.append((sigla, arquivo, tamanho, origem.stat().st_size))

    total = sum(t for _, _, t, _ in encontrados)
    original = sum(o for _, _, _, o in encontrados)
    print(f"Insígnias encontradas: {len(encontrados)} -- {original / 1024 / 1024:.1f} MB no "
          f"repositório, {total / 1024:.0f} KB depois de reduzir para {LADO_MAX}px")
    print(f"Unidades de topo que usam o brasão: {len(USA_BRASAO)} -> {USA_BRASAO}")
    if faltando:
        print(f"\nAVISO: {len(faltando)} sem PNG no repositório:")
        for sigla, sub in faltando:
            print(f"   {sigla:<16} esperado em {sub}")
    if copiar:
        print(f"\nCopiado para {DESTINO.relative_to(RAIZ)}")
    else:
        print("\n(nada copiado -- rode com --copiar)")


if __name__ == "__main__":
    main()
