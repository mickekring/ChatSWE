import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'No query provided' }, { status: 400 })
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        include_images: false,
        include_raw_content: false,
        max_results: 5
      })
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Format the search results
    let formattedResults = ''
    
    if (data.answer) {
      formattedResults += `**Answer**: ${data.answer}\n\n`
    }
    
    if (data.results && data.results.length > 0) {
      formattedResults += '**Search Results**:\n'
      data.results.forEach((result: any, index: number) => {
        formattedResults += `${index + 1}. **${result.title}**\n`
        formattedResults += `   ${result.content}\n`
        formattedResults += `   Source: ${result.url}\n\n`
      })
    }

    return NextResponse.json({ 
      content: formattedResults || 'No results found.',
      query: query 
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}