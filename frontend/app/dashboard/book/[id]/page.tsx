import { BookClient } from './BookClient';


// Inside your component function...


export default function BookPage({ params }: { params: { id: string } }) {
  return <BookClient bookId={params.id} />;
}