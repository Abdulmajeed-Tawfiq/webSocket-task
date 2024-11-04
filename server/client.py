import re
import time
import asyncio
import websockets

# This is the expected full text that the websocket server will send piece by piece.
# It simulates what a model might create for a business strategy thread.
expected_text = '''If you're struggling to grow your business, here are some strategies that will help.

----------

1/5) Focus On Your Niche
You can't be everything for everyone.
Focus on a specific niche or industry and tailor your sales strategy around it. This is where the money is at!

----------

2/5) Use Storytelling To Sell
People don’t buy products, they buy stories behind those products.

Use storytelling to sell by sharing customer testimonials, case studies, and other success stories that will make potential customers believe in you.

----------

3/5) Create Content That Educates
Content is king.
Create content that educates your audience about their problems. This builds trust with them which leads to sales.

You can create videos, podcasts, blog posts or even social media posts.

----------

4/5) Leverage Social Media
Social media has become a major channel for businesses to reach out to potential customers and build brand awareness.
Use platforms like Facebook, Instagram, Twitter, LinkedIn etc. to promote your business.

----------

5/5) Build A Community Around Your Business
Your community is the lifeblood of any successful business.
Build relationships with your existing customers by engaging them on social media or through email marketing campaigns.

This will help you retain and grow your customer base!'''

# The server sends portions of the text via websocket as they are created.
# The format of each message is: <start_index>:<end_index> <message>
# Example: `1279:1284 speed` means characters between indexes 1279 and 1284 spell the word "speed".

# Function to extract the start_index, end_index, and the actual message from the server response.
def extract_words_groups(text):
    pattern = r"(\d+)\:(\d+) ([\s\S]*)$"  # Regex to match index ranges and message content
    match = re.search(pattern, text)

    if match:
        # Extract and return the start and end indexes, and the words
        start_index = int(match.group(1))
        end_index = int(match.group(2))
        words = match.group(3)
        return start_index, end_index, words
    else:
        return None

# Function to check if the server has finished generating the text.
# The server sends a message in this format when done: <DONE:full_text_length>
def extract_done(text):
    pattern = r"\<DONE\:(\d+)\>$"  # Regex to match a done message with full length
    match = re.search(pattern, text)

    if match:
        return int(match.group(1))  # Return the full_text_length
    else:
        return None

# Variable to simulate server errors by introducing packet disorder.
# It represents the percentage of messages sent out of order. 
# Test values up to 90% for realism.
error_percentage: int = 25  # Must be a positive integer between 0 and 100 (though 100% is impossible to implement).

# Function to establish a websocket connection with the server and handle message exchange.
async def connect_to_server(n):
    start_time = time.perf_counter()  # Start the timer to measure connection time
    uri = f"wss://api.creatorwithai.com/ws/{error_percentage}"  # Websocket URL
    text = ''  # Variable to store the text received from the server

    async with websockets.connect(uri) as websocket:
        # Send the initial request to the model to create a thread about business strategies.
        await websocket.send('Write me a thread about business strategies.') # Doesn't matter in this case, the backend won't care, it will return the same thread every time to test.
        prev_end = 0  # Track the end index of the previously received message

        while True:
            msg = await websocket.recv()  # Receive a message from the server
            print(msg)
            # If the server sends this, it indicates that the connection should be closed.
            # This is sent after the client sends <CLOSE_REQ>
            if msg == '<CLOSE_ACC>':
                await websocket.close()
                break

            # Check if the server indicates it's done generating the full text.
            done_index = extract_done(text=msg)
            if done_index:
                # If the server thinks it's done but we haven't received the full text, ask for the missing part.
                if prev_end != done_index:
                    await websocket.send(f'<INDEX:{prev_end}>')  # Request missing content
                    
                else:
                    # If we've received the full text, request to close the connection.
                    await websocket.send("<CLOSE_REQ>")
                    end_time = time.perf_counter()  # Stop the timer when the process is complete
                
                continue

            # Extract the start index, end index, and words from the server's message.
            words_groups = extract_words_groups(msg)
            if words_groups:
                start, end, words = int(words_groups[0]), int(words_groups[1]), words_groups[2]

                # If the new start index doesn't match the previous end index, request the missing part.
                if start != prev_end:
                    await websocket.send(f'<INDEX:{prev_end}>')
                    continue

            # Append the received words to the full text
            text += words
            # print(words, end='', flush=True)  # Print the words in real-time to the terminal
            prev_end = end  # Update the previous end index with the new one

        print()
        print('Correct:', text == expected_text)  # Check if the received text matches the expected text

    print(f'This took {end_time - start_time} seconds.')  # Display the total time taken


async def main():    
    # await asyncio.gather(*[connect_to_server(n) for n in range(10)])
    await connect_to_server(1)

if __name__ == "__main__":
    asyncio.run(main())
