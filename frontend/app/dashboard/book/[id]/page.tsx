import { BookClient } from './BookClient';

export default function BookPage({ params }: { params: { id: string } }) {
  return <BookClient bookId={params.id} />;
}