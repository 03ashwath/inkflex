import pandas as pd
import numpy as np
import random
import os

def generate_mock_data(num_samples=5000):
    np.random.seed(42)
    random.seed(42)

    countries = ['US', 'UK', 'IN', 'AU']
    # Base prices by country
    base_price_map = {'US': 100, 'UK': 80, 'IN': 95, 'AU': 90}
    
    cities = {
        'US': ['New York', 'Los Angeles', 'Chicago', 'Austin', 'Miami'],
        'UK': ['London', 'Manchester', 'Birmingham', 'Edinburgh'],
        'IN': ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Mangaluru', 'Bengaluru'],
        'AU': ['Sydney', 'Melbourne', 'Brisbane', 'Perth']
    }
    
    # City multiplier (e.g. New York is more expensive)
    city_mult = {
        'New York': 1.5, 'Los Angeles': 1.4, 'Chicago': 1.2, 'Austin': 1.1, 'Miami': 1.2,
        'London': 1.5, 'Manchester': 1.1, 'Birmingham': 1.0, 'Edinburgh': 1.1,
        'Mumbai': 1.4, 'Delhi': 1.3, 'Bangalore': 1.3, 'Pune': 1.1, 'Mangaluru': 1.2, 'Bengaluru': 1.3,
        'Sydney': 1.3, 'Melbourne': 1.2, 'Brisbane': 1.1, 'Perth': 1.1
    }

    body_parts = ['Forearm', 'Upper arm', 'Shoulder', 'Chest', 'Back', 'Upper back', 'Lower back', 'Wrist', 'Hand', 'Finger', 'Thigh', 'Calf', 'Ankle', 'Foot', 'Rib', 'Neck', 'Behind ear']
    body_part_mult = {bp: 1.0 for bp in body_parts}
    body_part_mult['Rib'] = 1.3
    body_part_mult['Neck'] = 1.4
    body_part_mult['Hand'] = 1.2
    body_part_mult['Finger'] = 1.1
    body_part_mult['Back'] = 1.1

    styles = ['Traditional', 'Realism', 'Watercolor', 'Tribal', 'New School', 'Neo Traditional', 'Japanese', 'Blackwork', 'Minimalist', 'Geometric']
    style_mult = {
        'Realism': 1.5, 'Japanese': 1.4, 'Watercolor': 1.3, 'Neo Traditional': 1.2,
        'Traditional': 1.0, 'Tribal': 1.0, 'Blackwork': 1.1, 'Minimalist': 0.8,
        'Geometric': 1.1, 'New School': 1.2
    }

    data = []
    
    for _ in range(num_samples):
        country = random.choice(countries)
        city = random.choice(cities[country])
        
        # size in sq inches approximately
        size_sq_inches = np.random.lognormal(mean=2.5, sigma=0.8) 
        size_sq_inches = max(1, min(size_sq_inches, 200)) # cap between 1 and 200
        
        body_part = random.choice(body_parts)
        style = random.choice(styles)
        
        complexity = np.random.randint(1, 11) # 1 to 10
        is_color = random.choice([0, 1])
        color_count = random.randint(2, 8) if is_color else 1
        
        shading_level = np.random.randint(1, 11)
        
        # Calculate time in hours
        # Base time: 0.5 hours setup + time proportional to size and complexity
        base_time = 0.5 + (size_sq_inches * 0.1) * (complexity * 0.1) * (1.2 if is_color else 1.0) * (shading_level * 0.1)
        estimated_hours = round(max(0.5, base_time), 1)
        
        # Hourly rate based on location
        hourly_rate = base_price_map[country] * city_mult[city]
        
        # Calculate price
        base_calc_price = estimated_hours * hourly_rate * style_mult[style] * body_part_mult[body_part]
        
        # Add random noise for artist variance
        noise = np.random.normal(1.0, 0.15) 
        final_price = round(base_calc_price * noise, 2)
        
        data.append({
            'country': country,
            'city': city,
            'size_sq_inches': round(size_sq_inches, 2),
            'body_part': body_part,
            'tattoo_style': style,
            'complexity': complexity,
            'is_color': is_color,
            'color_count': color_count,
            'shading_level': shading_level,
            'estimated_hours': estimated_hours,
            'final_price': final_price
        })

    df = pd.DataFrame(data)
    
    os.makedirs(os.path.join(os.path.dirname(__file__), '../data'), exist_ok=True)
    df.to_csv(os.path.join(os.path.dirname(__file__), '../data/synthetic_tattoo_data.csv'), index=False)
    print(f"Generated {num_samples} records and saved to synthetic_tattoo_data.csv")

if __name__ == "__main__":
    generate_mock_data()
