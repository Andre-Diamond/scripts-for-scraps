import Link from 'next/link';

const Nav = () => {

   //console.log(session, isAdmin)
  return (
    <nav className="routes">
          <Link href="/" className="navitems">
            Home
          </Link>
          <Link href="/scripts/extract-participants" className="navitems">
            Extract Meeting Participants
          </Link>
    </nav>
  );
};

export default Nav;