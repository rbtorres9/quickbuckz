import { useStore } from '../data/store.jsx'
import PeopleList from '../components/PeopleList.jsx'

export default function Followers() {
  const { followers } = useStore()
  return <PeopleList title="Followers" handles={followers} emptyText="No one is following you yet." />
}
