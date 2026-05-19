import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase';

// GET all posts
export async function GET() {
  try {
    const { data: posts, error } = await supabasePublic
      .from('POSTS')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch posts', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, media_type, description, media_url, user_id } = body;

    // Validate required fields
    if (!title || !media_type || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: post, error } = await supabasePublic
      .from('POSTS')
      .insert([
        {
          title,
          media_type,
          description: description || '',
          media_url: media_url || null,
          user_id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return NextResponse.json(
        { error: 'Failed to create post', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
