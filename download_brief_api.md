# Download Brief PDF API

## Endpoint
```
POST /download-brief
```

## Request
**Headers:**
- `Content-Type: application/json`
- Cookie with valid `session_id` (same as other authenticated endpoints)

**Body:**
```json
{
  "chat_id": "string",
  "node_id": "string"
}
```

## Response
- **Content-Type:** `application/pdf`
- **Content-Disposition:** `attachment; filename="trevi_brief_{node_id}.pdf"`
- Returns the PDF file as a binary stream

## Example Usage (JavaScript/Fetch)
```javascript
async function downloadBrief(chatId, nodeId) {
  const response = await fetch('/download-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important: sends session cookie
    body: JSON.stringify({ chat_id: chatId, node_id: nodeId })
  });
  
  if (!response.ok) throw new Error('Download failed');
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  // Trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `trevi_brief_${nodeId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

## Notes
- Uses same `chat_id` and `node_id` as the `/trevi-brief` endpoint
- Self-healing: if brief doesn't exist, it generates one automatically
- PDF includes: Summary (TLDR), Key Topics, and Node Summaries with Trevi branding
