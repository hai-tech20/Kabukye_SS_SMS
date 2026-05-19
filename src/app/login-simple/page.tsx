'use client';

function TestButton() {
  console.log('Component rendering');
  
  const handleClick = () => {
    console.log('Button clicked!');
    alert('Button clicked!');
  };

  return (
    <button onClick={handleClick}>
      Click Me
    </button>
  );
}

export default function SimpleLogin() {
  return (
    <div>
      <h1>Simple Test</h1>
      <TestButton />
    </div>
  );
}
