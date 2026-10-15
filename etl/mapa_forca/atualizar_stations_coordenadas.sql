-- Coordenadas das estacoes do Mapa de Forca (public.stations, mapa_forca_api_development)
-- Gerado em 15/10/2026 por etl/mapa_forca/gerar_update_stations.py a partir da tabela informada
-- (planilha 'Localizacao SBs CBMPE'). Cada UPDATE so age se a estacao ainda estiver SEM coordenada, e so
-- preenche rua/numero/bairro/cidade onde estiverem vazios. Enderecos sugeridos vem da geocodificacao
-- reversa do OpenStreetMap (Nominatim) -- CONFIRA antes de executar. Rode dentro de uma transacao.

BEGIN;

-- [33] 1ªSB / SEDE | cadastro: RUA DOZE S/N SÃO CRISTÓVÃO ARCOVERDE | OSM: Rodovia BR-232 None Cidade Jardim Arcoverde
UPDATE public.stations SET latitude = -8.424294265, longitude = -37.073561664
  WHERE id = 33 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [41] CAT/SERTÃO | cadastro: AVENIDA MONSENHOR ÂNGELO SAMPAIO 100 CENTRO PETROLINA | OSM: Avenida Nilo Coelho None Gercino Coelho Petrolina
UPDATE public.stations SET latitude = -9.392950712, longitude = -40.509438322
  WHERE id = 41 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [43] 3ªSB / CUSTÓDIA | cadastro: CUSTÓDIA S/N ... CUSTÓDIA | OSM: Avenida Inocêncio Lima None Custódia Custódia
UPDATE public.stations SET latitude = -8.086583302, longitude = -37.650534596, neighborhood = coalesce(nullif(nullif(trim(neighborhood), ''), '--'), 'CUSTÓDIA')
  WHERE id = 43 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [46] CAT/AGRESTE 1 | cadastro: RUA QUINTINO BOCAIÚVA 400 BAIRRO MAURÍCIO DE NASSAU CARUARU | OSM: Rua Fernando Pontes Filho None Agamenon Magalhaes Caruaru
UPDATE public.stations SET latitude = -8.295924121, longitude = -35.989329148
  WHERE id = 46 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [59] 2ªSB / SÃO JOSÉ DO BELMONTE | cadastro: AVENIDA EUCLIDES DE CARVALHO 39 CENTRO SÃO JOSÉ DO BELMONTE | OSM: Travessa Santa Catarina None São José do Belmonte São José do Belmonte
UPDATE public.stations SET latitude = -7.865568502, longitude = -38.760432206
  WHERE id = 59 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [61] 3ªSB / SÃO JOSÉ DO EGITO | cadastro: RUA 25 DE AGOSTO S/N PLANALTO SÃO JOSÉ DO EGITO | OSM: Rua Vinte Cinco de Agosto None Venancio Campos São José do Egito
UPDATE public.stations SET latitude = -7.463971108, longitude = -37.27358285
  WHERE id = 61 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [62] ABMG | cadastro: BR-232 136 CURADO IV RECIFE | OSM: Rodovia Luiz Gonzaga None Curado IV Jaboatão dos Guararapes
UPDATE public.stations SET latitude = -8.0782, longitude = -34.985144
  WHERE id = 62 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [72] 1ªSB / VITÓRIA | cadastro: RODOVIA PE-45 S/N LÍDIA QUEIROZ VITÓRIA DE SANTO ANTÃO | OSM: Rua Adelio de Andrade None Lidia Queiroz Vitória de Santo Antão
UPDATE public.stations SET latitude = -8.124097277, longitude = -35.282289717
  WHERE id = 72 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [76] 2ªSB / BOM CONSELHO | cadastro: RUA CAP. LISIMACO S/N CENTO BOM CONSELHO | OSM: Rua Riacho Lava-Pes None Bom Conselho Bom Conselho
UPDATE public.stations SET latitude = -9.170189149, longitude = -36.68115482
  WHERE id = 76 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [105] 2ªSB / PALMARES | cadastro: BR 101 S/N CENTRO PALMARES | OSM: None None Santa Luzia Palmares
UPDATE public.stations SET latitude = -8.685624891, longitude = -35.584725235
  WHERE id = 105 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [107] CAT/ZM  | cadastro: PE 45 KM 02 BAIRRO LÍDIA QUEIROZ VITÓRIA DE SANTO ANTÃO | OSM: Rua Adelio de Andrade None Lidia Queiroz Vitória de Santo Antão
UPDATE public.stations SET latitude = -8.124097277, longitude = -35.282289717
  WHERE id = 107 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [111] 2ªSB / AFOGADOS DA INGAZEIRA | cadastro: PE - 320 KM 54 ZONA RURAL AFOGADOS DA INGAZEIRA | OSM: Rodovia PE-320 None Afogados da Ingazeira Afogados da Ingazeira
UPDATE public.stations SET latitude = -7.73680527, longitude = -37.641705843
  WHERE id = 111 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [113] 1ªSB / CARPINA | cadastro: AVENIDA CONSELHEIRO JOÃO ALFREDO 391 SANTA CRUZ CARPINA | OSM: Avenida Conselheiro João Alfredo None Santa Cruz Carpina
UPDATE public.stations SET latitude = -7.846941336, longitude = -35.246170484
  WHERE id = 113 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [132] 3ªSB / MACAPARANA | cadastro: RUA SEVERINO COSTA S/N CENTRO MACAPARANA | OSM: Rua Severino Costa None None Macaparana
UPDATE public.stations SET latitude = -7.554132723, longitude = -35.447962253
  WHERE id = 132 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [138] 3ªSB / GRAVATÁ | cadastro: RUA QUINZE DE NOVEMBRO S/N NOSSA SENHORA DAS GRAÇAS GRAVATÁ | OSM: Rua Quinze de Novembro None Privê Village Eldorado Gravatá
UPDATE public.stations SET latitude = -8.195177709, longitude = -35.55078306
  WHERE id = 138 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

-- [144] ABMG | cadastro: BR-232 136 CURADO RECIFE | OSM: Rodovia Luiz Gonzaga None Curado IV Jaboatão dos Guararapes
UPDATE public.stations SET latitude = -8.0782, longitude = -34.985144
  WHERE id = 144 AND (coalesce(latitude, 0) = 0 OR coalesce(longitude, 0) = 0);

COMMIT;

-- PROPOSTA (nao e da tabela informada): QCG e CATs da RMR ficam no QCG (decisao do usuario);
-- coordenada do Comando Geral que o DW ja tem. Descomente para aplicar.
-- UPDATE public.stations SET latitude = -8.051522, longitude = -34.890144
--   WHERE id IN (2, 3, 50, 51, 52, 93, 133, 136, 137) AND coalesce(latitude, 0) = 0;
--   2 CAT / RMR - 4ª SATEC; 3 QCG; 50 CAT / RMR - 1ª SATEC; 51 CAT / RMR - 2ª SATEC; 52 CAT / RMR - 3ª SATEC; 93 QCG; 133 QCG; 136 QCG; 137 QCG

-- AINDA SEM COORDENADA (nao constam na tabela informada):
--   [42] 4ª SATEC / SURUBIM/ CAT ZM  (CARPINA)
--   [54] 8° GB/3ª SB - TORITAMA (TORITAMA)
--   [79] POSTO 01 - NORONHA - PORTO (FERNANDO DE NORONHA)
--   [80] LAGOA DE ITAENGA / CAT ZM  (CARPINA)
--   [81] LAGOA DO CARRO / CAT ZM  (CARPINA)
--   [82] MACAPARANA / CAT ZM  (CARPINA)
--   [83] POSTO 02 - NORONHA - CONCEIÇÃO (FERNANDO DE NORONHA)
--   [89] ATI (RECIFE)
--   [96] CAT/SERTÃO - 1ª SATEC (SERRA TALHADA)
--   [98] 2ª SATEC / CARPINA / CAT ZM  (CARPINA)
--   [99] POSTO 03 - NORONHA - PRAIA DO CACHORRO (FERNANDO DE NORONHA)
--   [108] CAT/AGRESTE 3 (SURUBIM)
--   [109] 1ª SATEC / GOIANA/ CAT ZM (CARPINA)
--   [112] DINTER 1 (CARUARU)
--   [114] CAT/SERTÃO 5 (PETROLÂNDIA)
--   [116] CAT/SERTÃO 6 (OURICURI)
--   [117] ALIANÇA / CAT ZM  (CARPINA)
--   [118] BUENOS AIRES / CAT ZM  (CARPINA)
--   [119] CAMUTANGA / CAT ZM  (CARPINA)
--   [120] CONDADO / CAT ZM  (CARPINA)
--   [121] FERREIROS / CAT ZM  (CARPINA)
--   [122] ITAMBÉ / CAT ZM  (CARPINA)
--   [123] ITAQUATINGA / CAT ZM  (CARPINA)
--   [124] NAZARÉ DA MATA / CAT ZM  (CARPINA)
--   [125] PAUDALHO / CAT ZM (CARPINA)
--   [126] SÃO VICENTE FÉRRER / CAT ZM  (CARPINA)
--   [127] TIMBAÚBA / CAT ZM  (CARPINA)
--   [129] TRACUNHAÉM / CAT ZM  (CARPINA)
--   [130] VICÊNCIA / CAT ZM  (CARPINA)
--   [141] CAT/AGRESTE 2 (GARANHUNS)
--   [143] SBFN - FERNANDO DE NORONHA (PRAIA DO CACHORRO) (FERNANDO DE NORONHA)
