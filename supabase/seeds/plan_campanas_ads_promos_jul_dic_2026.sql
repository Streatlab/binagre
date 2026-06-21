-- Plan Maestro Ads & Promos Streat Lab · Jul-Dic 2026
-- 24 campañas del módulo Marketing/CRM (crm_campanas). Idempotente.

BEGIN;

DELETE FROM crm_campanas WHERE codigo_promo LIKE 'PLAN-%';

INSERT INTO crm_campanas
(nombre, marca, canal, tipo, objetivo_smart, kpi_principal, kpi_meta, codigo_promo, mecanica, mecanica_plataforma, fecha_inicio, fecha_fin, presupuesto, estado, producto)
VALUES
('Binagre · Ads siempre-activo','Binagre','uber_eats','captacion','ROAS >= 5 sostenido en Binagre todo el semestre','roas',5,'PLAN-UE-BIN-01','Sponsored Listing 8 EUR/dia (15 EUR/dia vie-dom)','ads_posicion','2026-07-13','2026-12-31',1800,'planificada','Carta Binagre'),
('Binagre · Gasta mas ahorra mas','Binagre','uber_eats','ticket_medio','Subir ticket medio Binagre +15% jue-dom','ticket_medio',15,'PLAN-UE-BIN-02','Gasta 30 EUR ahorra 6 EUR, jue-dom','pct_pedido','2026-09-01','2026-12-31',600,'planificada','Menus Binagre'),
('Binagre · Recompra torrija 2o pedido','Binagre','uber_eats','repeticion','Recompra 30d Binagre +5pt','recurrentes',5,'PLAN-UE-BIN-03','Torrija gratis con compra min 25 EUR, recordatorio automatico','nuevo_usuario','2026-09-21','2026-12-31',320,'planificada','Torrija'),
('Binagre · -20% nuevos clientes','Binagre','uber_eats','captacion','>=60 clientes nuevos en 2 semanas','nuevos_clientes',60,'PLAN-UE-BIN-04','-20% solo audiencia nuevos, presupuesto cerrado','descuento_item','2026-07-13','2026-07-26',150,'planificada','Carta Binagre'),
('Binagre · Top Rank JE oficinas','Binagre','just_eat','captacion','+18% pedidos JE Binagre','pedidos',18,'PLAN-JE-BIN-01','CP 28038/28018/28053 + 2 CP oficinas, tope 40-60 EUR/sem','ads_posicion','2026-07-13','2026-12-31',1300,'planificada','Carta Binagre'),
('Binagre · Oferta JE franja pico','Binagre','just_eat','ticket_medio','Cuota en franja vie-dom 20-22h','pedidos',0,'PLAN-JE-BIN-02','-10% en menus, vie-dom 20:00-22:00','descuento_item','2026-07-13','2026-12-31',540,'planificada','Menus Binagre'),
('Binagre · Happy hour Glovo picoteo','Binagre','glovo','repeticion','Pedidos 16-19h x2','pedidos',0,'PLAN-GL-BIN-01','-15% picoteo + CPC, horas activacion 16-19h','descuento_item','2026-08-01','2026-12-31',500,'planificada','Picoteo Binagre'),
('Asia · Lanzamiento -20%','Asia (paraguas)','uber_eats','captacion','150 pedidos + 50 resenas en 14 dias','nuevos_clientes',150,'PLAN-UE-ASIA-01','-20% toda la carta, listing nuevo','descuento_item','2026-07-13','2026-07-27',300,'planificada','Carta Asia'),
('Asia · Ads noche','Asia (paraguas)','uber_eats','captacion','ROAS >= 5 en franja 19-23h','roas',5,'PLAN-UE-ASIA-02','Sponsored 6 EUR/dia, solo 19-23h','ads_posicion','2026-07-13','2026-12-31',900,'planificada','Carta Asia'),
('Asia · 2x1 gyozas Glovo','Asia (paraguas)','glovo','repeticion','Pedidos mar-jue +30%','pedidos',30,'PLAN-GL-ASIA-01','2x1 gyozas mar-jue + CPC, horas 19-23h','2x1_bogo','2026-08-01','2026-12-31',450,'planificada','Gyozas'),
('Asia · BOGO korean wings eventos','Asia (paraguas)','uber_eats','captacion','Pico +50% en jornada de partido','pedidos',50,'PLAN-UE-ASIA-03','BOGO korean wings solo jornadas Champions','2x1_bogo','2026-09-01','2026-12-31',200,'planificada','Korean wings'),
('Asia · Top Rank JE finde','Asia (paraguas)','just_eat','captacion','ROAS >= 4 vie-sab','roas',4,'PLAN-JE-ASIA-01','CP Vallecas, solo vie-sab, tope 25 EUR/sem','ads_posicion','2026-08-01','2026-12-31',500,'planificada','Carta Asia'),
('Desayunos · Cafe gratis ofi','Desayunos/Brunch','uber_eats','repeticion','Pedidos oficina L-V manana','pedidos',0,'PLAN-UE-DES-01','Cafe gratis con min 12 EUR, L-V 8-11h','nuevo_usuario','2026-09-01','2026-12-31',280,'planificada','Cafe'),
('Desayunos · Happy hour Glovo manana','Desayunos/Brunch','glovo','captacion','Franja valle 10:30-12:30','pedidos',0,'PLAN-GL-DES-01','-15% + CPC, horas 10:30-12:30','descuento_item','2026-08-01','2026-12-31',300,'planificada','Carta Desayunos'),
('Desayunos · Ads manana','Desayunos/Brunch','uber_eats','captacion','ROAS >= 4 en franja 8-12h','roas',4,'PLAN-UE-DES-02','Sponsored 4 EUR/dia, solo 8-12h','ads_posicion','2026-07-13','2026-12-31',600,'planificada','Carta Desayunos'),
('Fritos · Ads constante','Fritos y Pollo','uber_eats','captacion','ROAS >= 5 (busqueda generica alta)','roas',5,'PLAN-UE-FRI-01','Sponsored 5 EUR/dia constante','ads_posicion','2026-07-13','2026-12-31',750,'planificada','Carta Fritos'),
('Fritos · BOGO tenders valle','Fritos y Pollo','uber_eats','repeticion','Valle mar-mie +25%','pedidos',25,'PLAN-UE-FRI-02','BOGO tenders mar-mie','2x1_bogo','2026-08-01','2026-12-31',400,'planificada','Tenders'),
('Fritos · Envio gratis Glovo','Fritos y Pollo','glovo','ticket_medio','Ticket Glovo +12%','ticket_medio',12,'PLAN-GL-FRI-01','Envio gratis con min 18 EUR + CPC','envio_gratis','2026-07-20','2026-12-31',450,'planificada','Carta Fritos'),
('Fritos · Bucket domingo JE','Fritos y Pollo','just_eat','ticket_medio','Domingos x1,5','pedidos',50,'PLAN-JE-FRI-01','Bucket -15% domingos + Top Rank 25 EUR/sem','descuento_item','2026-09-01','2026-12-31',560,'planificada','Bucket Compartir'),
('Milanesas · Ads finde + GMAM','Milanesas','uber_eats','ticket_medio','ROAS >= 4','roas',4,'PLAN-UE-MIL-01','Sponsored 4 EUR/dia vie-dom + Gasta 22 ahorra 4','descuento_item','2026-08-01','2026-12-31',500,'planificada','Milanesa XL'),
('Milanesas · Top Rank + oferta JE','Milanesas','just_eat','captacion','+18% pedidos','pedidos',18,'PLAN-JE-MIL-01','CP 28018/28053 20 EUR/sem + -10% vie-sab','ads_posicion','2026-09-01','2026-12-31',440,'planificada','Carta Milanesas'),
('Green · -15% bowls ofi + Ads','Green/Healthy','uber_eats','captacion','Pedidos oficina L-V mediodia','pedidos',0,'PLAN-UE-GRE-01','-15% bowls L-V 12-15h + Sponsored 4/dia mediodia','descuento_item','2026-08-01','2026-12-31',800,'planificada','Bowls'),
('Green · Happy hour post-gym Glovo','Green/Healthy','glovo','repeticion','Franja post-gym 17-20h','pedidos',0,'PLAN-GL-GRE-01','-10% High Protein 17-20h + CPC','descuento_item','2026-08-01','2026-12-31',350,'planificada','High Protein'),
('Latina · 2x1 Taco Tuesday Glovo','Latina/Tacos','glovo','repeticion','Martes x2','pedidos',100,'PLAN-GL-LAT-01','2x1 tacos solo martes + CPC nocturno','2x1_bogo','2026-07-20','2026-12-31',400,'planificada','Tacos');

COMMIT;
