"use client";

import { useParams } from "next/navigation";

const MyComponent = () => {
  const params = useParams();
  const id = params.id as string;

  return <div>ID: {id}</div>;
};

export default MyComponent;