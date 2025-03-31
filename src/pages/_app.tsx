import "../styles/globals.css";
import type { AppProps } from "next/app";
import Nav from '../components/nav'
import { GitbookSyncProvider } from '../contexts/GitbookSyncContext';

function MyApp({ Component, pageProps }: AppProps) {
  
  return (
    <GitbookSyncProvider>
      <div className="main">
        <div className="nav">
          <div>
            <Nav />
          </div>
        </div>
        <div className="component">
          <Component {...pageProps} />
        </div>
      </div>
    </GitbookSyncProvider>
  );
}

export default MyApp;