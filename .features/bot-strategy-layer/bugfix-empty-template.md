# Bugfix: Leerer Besucher-Bot nach Reset

## Aktuelles Verhalten (Bug)
Das Template enthält die komplette Level-1-Route und bewegt sich sofort.

## Erwartetes Verhalten
WHEN ein frischer Bot aktiviert wird SHALL DAS SYSTEM bei jeder Entscheidung `[]` liefern und keinen Bewegungsauftrag starten.

## Freigabe
Direkte Nutzerkorrektur vom 16.09.2026: Ein frischer Bot soll sich nicht bewegen und nur eine leere Entscheidung zurückliefern. Umsetzung im Rahmen der bestehenden Anweisung, autonom weiterzuarbeiten. Diese Korrektur ersetzt frühere Anforderungen an eine laufende Standardstrategie.

## Was bleibt unverändert (Regressions-Schutz)
Framework v2, Spiel und API bleiben unverändert. Die Level-1-Route bleibt in examples/strategies/messe-demo.js.

## Root Cause
Die ausgearbeitete Demonstrationsroute wurde zugleich als Reset-Vorlage verwendet.

## Fix-Ansatz
Zuerst Verhaltenstest für leere Entscheidungen und fehlende Aufträge; Routentests nur auf das Demo-Beispiel anwenden. Template auf Metadaten, API-Hinweise und decide mit return [] reduzieren. Anschließend reset-bot und Prüfung in /dev.
