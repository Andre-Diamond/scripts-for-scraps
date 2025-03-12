import React from 'react';

interface JSONFormatterProps {
  data: any;
}

const JSONFormatter: React.FC<JSONFormatterProps> = ({ data }) => {
  // Format the JSON with syntax highlighting
  const formatJSON = (json: any): string => {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, null, 2);
    }
    
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
        (match) => {
          let cls = 'number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'key';
            } else {
              cls = 'string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'boolean';
          } else if (/null/.test(match)) {
            cls = 'null';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
  };

  return (
    <pre 
      dangerouslySetInnerHTML={{ __html: formatJSON(data) }} 
    />
  );
};

export default JSONFormatter;