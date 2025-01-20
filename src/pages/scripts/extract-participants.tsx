import { useState } from 'react';
import { extractMeetingParticipants } from '@/scripts/data/extractMeetingParticipants';
import { ScriptResult } from '@/scripts/schema/meetingSummary';

export default function ExtractParticipantsPage() {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const runScript = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result: ScriptResult<string[]> = await extractMeetingParticipants();
      if (result.success && result.data) {
        setResults(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to run script');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Extract Meeting Participants</h1>
      
      <button
        onClick={runScript}
        disabled={isLoading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {isLoading ? 'Running...' : 'Run Script'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Results ({results.length} participants)</h2>
          <ul className="bg-gray-50 p-4 rounded">
            {results.map((name, index) => (
              <li key={index} className="mb-1">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}