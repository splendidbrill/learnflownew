export interface Book {
    id: string;
    title: string;
    author: string;
    book_type: string;
    total_blocks: number;
    created_at: string;
  }
  
  export interface ContentBlock {
    id: string;
    book_id: string;
    block_sequence: number;
    content_type: 'text' | 'diagram' | 'example' | 'question';
    original_content: string;
    diagram_url: string | null;
    cached_explanation: ExplanationResponse | null;
  }
  
  export interface ExplanationResponse {
    summary: string;
    analogy: string;
    key_concept: string;
    quiz_question: string;
    math_pattern?: {
      pattern_name: string;
      strategy: string;
      trigger: string;
    };
  }