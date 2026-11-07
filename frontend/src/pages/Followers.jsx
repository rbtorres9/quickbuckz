import { useParams } from 'react-router-dom'
import PeopleList from '../components/PeopleList.jsx'

// /followers = who follows you. /user/:handle/followers = who follows them.
export default function Followers() {
  const { handle } = useParams()
  if (handle) {
    return <PeopleList key={handle} title={`@${handle}'s followers`} direction="followers" username={handle} emptyText={`No one follows @${handle} yet.`} />
  }
  return <PeopleList title="Followers" direction="followers" emptyText="No one is following you yet." />
}
