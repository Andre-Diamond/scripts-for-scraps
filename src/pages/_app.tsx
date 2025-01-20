import "../styles/globals.css";
import type { AppProps } from "next/app";
import Nav from '../components/nav'

function MyApp({ Component, pageProps }: AppProps) {
  
  return (
    
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
  );
}

export default MyApp;
