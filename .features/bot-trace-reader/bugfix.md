# Bugfix: Ausgabegrenze ohne Diagnoseverlust

## Aktuelles Verhalten
Bei mehr als 12000 Zeichen ersetzt der Reader die gesamte Diagnose durch eine Fehlermeldung und fordert Rohdatenzugriff. Besucher-Agenten versuchen danach temporäre Dateien oder zusätzliche Rechte zu verwenden.
## Erwartetes Verhalten
Die Ausgabe wird stufenweise kompakter, behält Identität und Diagnose soweit möglich und kennzeichnet Auslassungen. Das Steering verlangt direkte stdout-Auswertung ohne Umleitung, temporäre Dateien, Rechteausweitung oder vollständige Rohdaten-Dumps.
## Unverändert
Read-only, keine neuen Abhängigkeiten, Revision-Prüfung, maximal 12000 Ausgabezeichen. Fehlende Evidenz bleibt fehlend.
## Root Cause
serializeReport verwirft den Bericht vollständig; Tool-Text und Steering empfehlen anschließend einen unklar begrenzten Rohdaten-Ausweg.
## Fix
Tests mit überlangen Summary-/Focus-Berichten zuerst. Strings, Listen und Details begrenzen statt alles zu verwerfen. Metadaten und Kernbefunde im letzten Fallback bewahren. Tool und Steering geben denselben sicheren nächsten Schritt vor: vorhandene Kurzdiagnose nutzen oder fehlenden Nachweis benennen.
Freigabe: aktuelle Beanstandung und bestehender Auftrag zur autonomen Verbesserung.
