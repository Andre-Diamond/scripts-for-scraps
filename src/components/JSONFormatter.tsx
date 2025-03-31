import React from 'react';

interface JSONFormatterProps {
  data: unknown;
  onCommit?: () => void;
  commitLabel?: string;
  showCommitButton?: boolean;
}

const JSONFormatter: React.FC<JSONFormatterProps> = ({
  data,
  onCommit,
  commitLabel = 'Commit',
  showCommitButton = false
}) => {
  // Format the JSON with syntax highlighting
  const formatJSON = (json: unknown): string => {
    // Convert to string if not already a string
    let jsonString: string;
    if (typeof json !== 'string') {
      jsonString = JSON.stringify(json, null, 2);
    } else {
      jsonString = json;
    }

    return jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match: string) => {
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
    <div className="json-formatter-container">
      {showCommitButton && onCommit && (
        <div className="commit-button-container">
          <button
            className="commit-button"
            onClick={onCommit}
          >
            {commitLabel}
          </button>
        </div>
      )}
      <pre
        dangerouslySetInnerHTML={{ __html: formatJSON(data) }}
      />
    </div>
  );
};

export default JSONFormatter;