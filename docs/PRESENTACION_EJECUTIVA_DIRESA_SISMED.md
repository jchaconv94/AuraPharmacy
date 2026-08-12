# DOSSIER TÉCNICO Y RESUMEN EJECUTIVO: TOOLKIT SISMED WEB
## Transformación Digital e Inteligencia Logística para la Gestión Farmacéutica en la DIRESA San Martín

---

### FICHA DEL DOCUMENTO INSTITUCIONAL
* **Entidad Destinataria:** Dirección Regional de Salud (DIRESA) San Martín - Oficina de Gestión de Medicamentos, Insumos y Drogas (DEMID) / Dirección Ejecutiva.
* **Sistema:** ToolKit SISMED Web (Plataforma Integrada de Inteligencia Logística Farmacéutica).
* **Marco Normativo Base:** Ficha Técnica FT-EAM-001 (Versión 02) del Ministerio de Salud (MINSA) - Directiva de Estimación de Necesidades y Evaluación de Disponibilidad.
* **Fecha de Emisión:** Agosto 2026.
* **Estado:** Documentación Oficial para Exposición y Evaluación Directiva.

---

## 1. RESUMEN EJECUTIVO Y PROPÓSITO DE DESARROLLO

El **ToolKit SISMED Web** nace como una solución tecnológica avanzada orientada a resolver los cuellos de botella estructurales en la cadena de suministro de medicamentos e insumos médicos esenciales en la Región San Martín. 

Históricamente, la gestión del **Informe de Consumo e Inventario (ICI)** y la consolidación de información del **Sistema de Suministro de Medicamentos e Insumos Médico-Quirúrgicos (SISMED)** se han ejecutado mediante procedimientos manuales y hojas de cálculo desarticuladas. Esta metodología tradicional presentaba serias limitaciones:
1. **Elevado margen de error humano** en el cálculo de consumos promedios y proyecciones.
2. **Demoras prolongadas (días o semanas)** en la detección de quiebres de stock o situaciones de sobrestock.
3. **Ineficiencia en las redistribuciones**, resultando en medicamentos vencidos en un establecimiento mientras otro vecino sufría de desabastecimiento crítico.
4. **Falta de visibilidad unificada** en tiempo real para los analistas de la Oficina de Gestión de Medicamentos de la DIRESA.

**ToolKit SISMED Web** automatiza, audita y estandariza todo el ciclo de análisis de requerimientos y consulta de existencias, garantizando decisiones basadas en datos precisos y en estricta observancia de las directivas del MINSA.

---

## 2. ALINEACIÓN NORMATIVA Y RUTINAS DE CÁLCULO TÉCNICO (FT-EAM-001 VER. 02)

El motor analítico del ToolKit SISMED implementa rigurosamente los algoritmos estandarizados por el Ministerio de Salud para la evaluación de la disponibilidad farmacéutica:

### A. Consumo Promedio Mensual Ajustado (CPMA)
Formula el consumo real mensual libre de sesgos por periodos sin stock:
$$\text{CPMA} = \frac{\sum \text{Unidades consumidas en los últimos 12 meses}}{\text{Número de meses con registro de consumo en los últimos 12 meses (ICI)}}$$

### B. Meses de Stock Disponible (MSD)
Determina la autonomía de inventario a la fecha de corte:
$$\text{MSD} = \frac{\text{Stock Actual Físico a la Fecha de Corte}}{\text{CPMA}}$$

### C. Clasificación Estandarizada de Condición de Stock
El sistema automatiza la categorización técnica de cada ítem del petitorio según la Ficha FT-EAM-001:

| Condición de Stock | Criterio Técnico MSD (FT-EAM-001) | Diagnóstico Logístico y Acción Requerida |
| :--- | :--- | :--- |
| **Desabastecido** | $\text{MSD} = 0$ | **Crítico:** Quiebre de stock total. Requiere reposición inmediata o compra de emergencia. |
| **Substock** | $0 < \text{MSD} < 2$ | **Riesgo:** Stock por debajo del nivel de seguridad (2 meses). Prioridad de atención. |
| **Normostock** | $2 \le \text{MSD} \le 6$<br>*(Nota: $1 \le \text{MSD} \le 6$ para Soluciones de Lista N°02)* | **Óptimo:** Rango equilibrado de abastecimiento para garantizar la atención continua. |
| **Sobrestock** | $\text{MSD} > 6$ | **Exceso:** Inventario supera los 6 meses. Candidato prioritario para **Redistribución Técnica**. |
| **Sin Rotación** | $\text{Stock} > 0$ y $\text{CPMA} = 0$ | **Inmovilizado:** Existencia física sin demanda registrada. Riesgo inminente de vencimiento. |
| **Sin Consumo** | $\text{Stock} = 0$ y $\text{CPMA}_{(\text{últimos 4 meses})} = 0$ | **Pasivo:** Sin existencias y sin consumo reciente. Permite depurar el petitorio activo. |

---

## 3. ANÁLISIS PROFUNDO DE LOS MÓDULOS PRINCIPALES

El ToolKit SISMED concentra su potencia operativa en dos módulos estratégicos diseñados para transformar los datos crudos del SISMED en decisiones logísticas oportunas.

---

### MÓDULO 1: ANÁLISIS DE REQUERIMIENTO E INTELIGENCIA LOGÍSTICA

Este módulo actúa como el motor de auditoría y proyección de necesidades farmacéuticas.

#### Funcionalidades Clave:
1. **Ingesta y Auditoría de Datos al 100%:**
   - Carga automatizada del archivo ICI / matriz de inventarios sin límite de renglones.
   - Proceso de validación e inspección ítem por ítem que detecta inconsistencias en códigos SISMED, nombres de medicamentos, concentraciones y precios unitarios.
   - Barra de progreso interactiva con notificación de **Auditoría Finalizada al 100%** para control de calidad antes de generar reportes.

2. **Proyección por Horizontes de Abastecimiento:**
   - **Stock Inicial:** Análisis del stock físico disponible a la fecha de corte.
   - **Proyectado (CPA Simple):** Proyección con Consumo Promedio Anual tradicional.
   - **Proyectado (CPA Ajustado):** Proyección avanzada aplicando el algoritmo **CPMA** (limpiando meses con quiebre de stock para no subestimar la demanda real).

3. **Filtros de Priorización Sanitaria:**
   - **Disponibilidad de Medicamentos Esenciales (DME):** Evaluación focalizada del indicador estratégico regional (% DME), filtrando al instante los medicamentos del Petitorio Nacional Único de Medicamentos Esenciales (PNUME).
   - **Filtrado por Diagnóstico de Disponibilidad:** Permite aislar en un solo clic los productos en Desabastecimiento o Substock para su atención urgente, o en Sobrestock para redistribución.

4. **Matriz Dinámica de Redistribución:**
   - Identifica de forma automática qué establecimientos de la Red Sanitaria poseen exceso de stock ($\text{MSD} > 6$) de un medicamento que se encuentra desabastecido ($\text{MSD} = 0$) en otra IPRESS, sugiriendo las cantidades exactas a transferir.

---

### MÓDULO 2: CONSULTA Y MONITOREO DE STOCK EN TIEMPO REAL

Este módulo proporciona una sala de situación o "Control Tower" de los inventarios farmacéuticos de la Región San Martín.

#### Funcionalidades Clave:
1. **Visibilidad Multinivel (DIRESA - Red/UNGET - IPRESS):**
   - Monitoreo consolidado regional con capacidad de hacer *drill-down* (desglose detallado) hasta el stock físico de una farmacia de puesto o centro de salud específico.

2. **Trazabilidad Detallada por Lote y Vencimiento:**
   - Consulta no solo de la cantidad global, sino del desglose por **Número de Lote**, **Fecha de Vencimiento**, **Laboratorio Fabricante** y **Registro Sanitario**.
   - **Semáforo de Vencimientos:** Clasificación visual de productos con vencimiento en 30, 60, 90 días o vencidos, permitiendo aplicar estrictamente la regla **FEFO** (*First Expired, First Out*).

3. **Búsqueda Inteligente Multicriterio:**
   - Búsqueda ultra-rápida por Código SISMED, Denominación Común Internacional (DCI), Forma Farmacéutica o Grupo Terapéutico.
   - Filtros por estado de conservación (Cadena de Frío, Controlados, Foto-sensibles).

---

## 4. MATRICES EXPORTABLES Y HERRAMIENTAS DE DECISIÓN (PDF Y EXCEL)

Una de las mayores fortalezas del ToolKit SISMED es su capacidad de traducir análisis complejos en documentos administrativos oficiales listos para la toma de acciones.

```
+-----------------------------------------------------------------------------------+
|                            TOOLKIT SISMED WEB ENGINE                              |
|                                                                                   |
|  +------------------------------+             +--------------------------------+  |
|  |   ANÁLISIS DE REQUERIMIENTO  |             |        CONSULTA DE STOCK       |  |
|  |  - Ingesta ICI (100% Audit)  |             |  - Visibilidad Real-Time IPRESS |  |
|  |  - CPMA & MSD (FT-EAM-001)   |             |  - Lotes, FEFO & Vencimientos  |  |
|  +--------------+---------------+             +---------------+----------------+  |
|                 |                                             |                   |
|                 +----------------------+----------------------+                   |
|                                        |                                          |
|                                        v                                          |
|                       +---------------------------------+                         |
|                       |  PRODUCTOS Y MATRICES SALIDA    |                         |
|                       +---------------------------------+                         |
|                                        |                                          |
|                 +----------------------+----------------------+                   |
|                 |                                             |                   |
|                 v                                             v                   |
|    +-------------------------+                   +--------------------------+     |
|    | INFORME EJECUTIVO PDF   |                   | MATRIZ EXCEL ESTRUCTURADA|     |
|    | - Formato Imprimible    |                   | - Hojas para Operativa   |     |
|    | - Secciones de Firma    |                   | - Guías de Transferencia |     |
|    | - Resumen Directivo     |                   | - Redistribución Física  |     |
|    +-------------------------+                   +--------------------------+     |
+-----------------------------------------------------------------------------------+
```

1. **Informes Ejecutivos en PDF (Listos para Firma Institucional):**
   - Documento con formato ejecutivo oficial de la DIRESA San Martín.
   - Contiene resumen gráfico de disponibilidad, tabla de ítems críticos y espacio normativo para **firmas de validación** del Responsable de Farmacia y el Director de la DEMID.
   - Ideal para sustentar solicitudes de compra de emergencia, transferencias presupuestales o auditorías de la Contraloría.

2. **Matrices Operativas en Excel Estructurado:**
   - Archivos descargables tabulados que contienen las columnas exactas requeridas para los sistemas de distribución del SISMED.
   - Facilita la generación directa de **Pecosas, Guías de Remisión y Órdenes de Transferencia** entre almacenes especializados.

---

## 5. VENTAJAS COMPETITIVAS Y TECNOLÓGICAS

| Dimensión | Método Tradicional (Manual / Hojas de Cálculo) | **ToolKit SISMED Web** |
| :--- | :--- | :--- |
| **Tiempo de Procesamiento** | De 3 a 5 días por consolidado de Red. | **Segundos (Procesamiento inmediato).** |
| **Confiabilidad de Cálculos** | Propensa a errores de formulación y tipeo. | **100% Exactitud algorítmica según FT-EAM-001.** |
| **Auditoría de Datos** | Inexistente o muestral. | **Auditoría completa al 100% del archivo.** |
| **Gestión de Sobrestock** | Inoperativa (los excesos no se identifican). | **Sugerencia automática de redistribución.** |
| **Acceso a la Información** | Archivos aislados en computadoras locales. | **Acceso web centralizado, seguro y multiusuario.** |
| **Trazabilidad por Lote** | Compleja y dispersa. | **Visualización inmediata con semáforo FEFO.** |

---

## 6. MATRIZ DE IMPACTO EN LOS USUARIOS DEL SISTEMA

El despliegue de ToolKit SISMED beneficia directamente a los dos actores clave del sistema farmacéutico regional:

```
                  +--------------------------------------------------+
                  |         DIRESA SAN MARTÍN / DEMID                |
                  |    (Oficina de Gestión de Medicamentos)          |
                  |  - Toma de Decisiones Estratégica Regional       |
                  |  - Elevación del Indicador DME (>90%)             |
                  |  - Cero Medicamentos Vencidos por Inacción       |
                  +-------------------------+------------------------+
                                            |
                                            | Coordinación y Monitoreo
                                            v
                  +--------------------------------------------------+
                  |      ESTABLECIMIENTOS DE SALUD (IPRESS/UNGET)    |
                  |        (Personal de Farmacia / Almacén)          |
                  |  - Reducción del 90% de Carga Administrativa    |
                  |  - Sustento Técnico Automático de Pedidos        |
                  |  - Alertas Tempranas de Vencimientos y Lotes      |
                  +--------------------------------------------------+
```

### A. Impacto en el Personal de Farmacia (IPRESS / UNGET / Puestos de Salud)
* **Reducción del 90% en Carga Administrativa Manual:** El personal farmacéutico deja de invertir decenas de horas al mes en cálculos manuales y llenado repetitivo de cuadros, pudiendo dedicar más tiempo a la **Atención Farmacéutica y Farmacovigilancia**.
* **Sustento Técnico Irrefutable:** Sus requerimientos de reabastecimiento quedan formalmente justificados mediante fórmulas estandarizadas del MINSA (CPMA y MSD), evitando recortes arbitrarios.
* **Prevención Activa de Pérdidas:** Las alertas tempranas de vencimiento permiten al responsable de farmacia solicitar la salida o redistribución de lotes próximos a vencer antes de su expiración física.

### B. Impacto en la Oficina de Gestión de Medicamentos (DEMID - DIRESA San Martín)
* **Control Macro Regional y Toma de Decisiones Oportuna:** Los directivos cuentan con una visión panorámica instantánea de la disponibilidad de medicamentos esenciales a nivel de toda la región San Martín.
* **Optimización del Presupuesto Público:** Permite equilibrar la disponibilidad mediante **redistribuciones internas** entre IPRESS sin necesidad de incurrir inmediatamente en compras adicionales, maximizando el rendimiento de los recursos financieros.
* **Cumplimiento de Indicadores de Gestión Sanitaria:** Eleva el porcentaje de **Disponibilidad de Medicamentos Esenciales (DME)** de la región ante el MINSA y SIS (Seguro Integral de Salud), protegiendo los compromisos de gestión regionales.
* **Transparencia y Rendición de Cuentas:** Genera un historial auditable en PDF/Excel que respalda cada movimiento de stock ante órganos de control gubernamental.

---

## 7. PERSPECTIVA DE EXPANSIÓN MÓDULO DE INMUNIZACIONES (BIOLÓGICOS)

Como parte de la hoja de ruta de desarrollo continuo, ToolKit SISMED se encuentra expandiendo sus capacidades para incluir la gestión de biológicos a través del **Módulo de Inmunizaciones**.

* **Propósito:** Trazabilidad estricta por dosis y lote para vacunas desde el Almacén Regional de la DIRESA, pasando por las Redes de Salud (UNGET/OGESS), hasta la aplicación en el vacunatorio de la IPRESS.
* **Mecanismos:** Cierres mensuales de movimiento biológico, actas de recepción con incidencias, control de cadena de frío y reportes específicos regionalizados.

Esta expansión consolidará a ToolKit SISMED como la **plataforma integral de logística sanitaria de referencia en la Región San Martín**.

---

## 8. CONCLUSIÓN Y RECOMENDACIÓN INSTITUCIONAL

El **ToolKit SISMED Web** representa un salto cualitativo trascendental de la gestión reactiva e informal hacia una **Gestión Farmacéutica Digital, Científica y Basada en Evidencia**. 

Su implementación formal en la DIRESA San Martín no solo optimizará el trabajo diario del personal de farmacia y los analistas de la DEMID, sino que garantizará el objetivo fundamental de la salud pública: **que cada paciente en la Región San Martín reciba su medicamento esencial de forma oportuna, segura y completa.**

---
*Documento preparado para exposición directiva y evaluación técnica institucional.*
*DIRESA San Martín - Agosto 2026.*
