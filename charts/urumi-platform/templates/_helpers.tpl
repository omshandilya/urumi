{{- define "urumi.name" -}}urumi{{- end }}
{{- define "urumi.labels" -}}
app.kubernetes.io/name: {{ include "urumi.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
