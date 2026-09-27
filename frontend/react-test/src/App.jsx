import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function TypingExample() {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault(); // stops the browser's default full-page reload
    console.log("Submitted:", text);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Submit</button>
    </form>
  );
}

export default TypingExample;