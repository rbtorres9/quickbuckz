import PeopleList from '../components/PeopleList.jsx'
import PeopleSearch from '../components/PeopleSearch.jsx'

export default function Following() {
  return (
    <PeopleList title="Following" direction="following" emptyText="You're not following anyone yet.">
      <PeopleSearch />
    </PeopleList>
  )
}
