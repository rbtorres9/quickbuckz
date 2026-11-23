import { useParams } from 'react-router-dom'
import PeopleList from '../components/PeopleList.jsx'
import PeopleSearch from '../components/PeopleSearch.jsx'
import RequestsLink from '../components/RequestsLink.jsx'
import FollowSuggestions from '../components/FollowSuggestions.jsx'



// /subscriptions = who you follow (with search). /user/:handle/following = who they follow.
export default function Following() {
  const { handle } = useParams()
  if (handle) {
    return <PeopleList key={handle} title={`@${handle} follows`} direction="following" username={handle} emptyText={`@${handle} isn't following anyone yet.`} />
  }
  return (
    <PeopleList title="Following" direction="following" emptyText="You're not following anyone yet." titleAction={<RequestsLink />} footer={<FollowSuggestions />}>
      <PeopleSearch />
    </PeopleList>
  )
}
