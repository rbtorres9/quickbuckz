import { useStore } from '../data/store.jsx'
import PeopleList from '../components/PeopleList.jsx'

export default function Following() {
  const { following } = useStore()
  return <PeopleList title="Following" handles={following} emptyText="You're not following anyone yet." />
}
