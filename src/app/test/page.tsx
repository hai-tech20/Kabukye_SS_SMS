'use client';

export default function TestPage() {
  const handleClick = () => {
    alert('Test page works!');
    console.log('Test page clicked!');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-4">JavaScript Test Page</h1>
        <button
          onClick={handleClick}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg"
        >
          Click Me
        </button>
      </div>
    </div>
  );
}
